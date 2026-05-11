use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::Mutex;
use redb::{Database, ReadableTable, TableDefinition};
use serde::{Deserialize, Serialize};

use super::error::AppError;

const TABLE: TableDefinition<u64, &[u8]> = TableDefinition::new("events");
/// Max events returned in a single load to prevent OOM on huge datasets.
const MAX_LOAD_EVENTS: usize = 50_000;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsEvent {
    pub ts: u64,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value2: Option<f64>,
}

pub struct AnalyticsState {
    db_path: OnceLock<PathBuf>,
    db: Mutex<Option<Database>>,
    /// Monotonic counter to guarantee unique keys even for same-ms events.
    counter: AtomicU64,
}

impl Default for AnalyticsState {
    fn default() -> Self {
        Self {
            db_path: OnceLock::new(),
            db: Mutex::new(None),
            counter: AtomicU64::new(0),
        }
    }
}

impl AnalyticsState {
    fn resolve_path(&self, app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
        if let Some(p) = self.db_path.get() {
            return Ok(p.clone());
        }
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Analytics(format!("failed to resolve app_data_dir: {}", e)))?;
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("analytics.redb");
        let _ = self.db_path.set(path.clone());
        Ok(path)
    }

    fn open_db(&self, app: &tauri::AppHandle) -> Result<(), AppError> {
        let mut guard = self.db.lock();
        if guard.is_some() {
            return Ok(());
        }
        let path = self.resolve_path(app)?;
        let db = Database::create(&path)
            .map_err(|e| AppError::Analytics(format!("failed to open analytics db: {}", e)))?;
        // Ensure table exists
        let txn = db
            .begin_write()
            .map_err(|e| AppError::Analytics(format!("begin_write failed: {}", e)))?;
        {
            let _ = txn.open_table(TABLE);
        }
        txn.commit()
            .map_err(|e| AppError::Analytics(format!("commit failed: {}", e)))?;
        *guard = Some(db);
        Ok(())
    }

    fn with_db<F, R>(&self, app: &tauri::AppHandle, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&Database) -> Result<R, AppError>,
    {
        self.open_db(app)?;
        let guard = self.db.lock();
        let db = guard
            .as_ref()
            .ok_or_else(|| AppError::Analytics("db not open".to_string()))?;
        f(db)
    }
}

use tauri::Manager;

#[tauri::command]
pub fn analytics_save(
    app: tauri::AppHandle,
    state: tauri::State<'_, AnalyticsState>,
    events: Vec<AnalyticsEvent>,
) -> Result<(), AppError> {
    if events.is_empty() {
        return Ok(());
    }
    state.with_db(&app, |db| {
        let txn = db
            .begin_write()
            .map_err(|e| AppError::Analytics(format!("begin_write failed: {}", e)))?;
        {
            let mut table = txn
                .open_table(TABLE)
                .map_err(|e| AppError::Analytics(format!("open_table failed: {}", e)))?;
            for event in &events {
                let bytes = serde_json::to_vec(event)?;
                // Combine timestamp with atomic counter for guaranteed unique keys.
                // High 48 bits = ms timestamp, low 16 bits = counter.
                let seq = state.counter.fetch_add(1, Ordering::Relaxed) & 0xFFFF;
                let key = (event.ts << 16) | seq;
                table
                    .insert(key, bytes.as_slice())
                    .map_err(|e| AppError::Analytics(format!("insert failed: {}", e)))?;
            }
        }
        txn.commit()
            .map_err(|e| AppError::Analytics(format!("commit failed: {}", e)))?;
        Ok(())
    })
}

#[tauri::command]
pub fn analytics_load(
    app: tauri::AppHandle,
    state: tauri::State<'_, AnalyticsState>,
    since: Option<u64>,
) -> Result<Vec<AnalyticsEvent>, AppError> {
    state.with_db(&app, |db| {
        let txn = db
            .begin_read()
            .map_err(|e| AppError::Analytics(format!("begin_read failed: {}", e)))?;
        let table = txn
            .open_table(TABLE)
            .map_err(|e| AppError::Analytics(format!("open_table failed: {}", e)))?;
        let mut results = Vec::new();
        let start_key = if let Some(start) = since { start << 16 } else { 0u64 };
        let iter = table
            .range(start_key..u64::MAX)
            .map_err(|e| AppError::Analytics(format!("range failed: {}", e)))?;
        for entry in iter {
            let (_, val) = entry
                .map_err(|e| AppError::Analytics(format!("iter entry failed: {}", e)))?;
            if let Ok(event) = serde_json::from_slice::<AnalyticsEvent>(val.value()) {
                results.push(event);
                if results.len() >= MAX_LOAD_EVENTS {
                    break;
                }
            }
        }
        Ok(results)
    })
}

#[tauri::command]
pub fn analytics_clear(
    app: tauri::AppHandle,
    state: tauri::State<'_, AnalyticsState>,
) -> Result<(), AppError> {
    // Close db, delete file, reopen
    {
        let mut guard = state.db.lock();
        *guard = None;
    }
    let path = state.resolve_path(&app)?;
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    // Reopen fresh
    state.open_db(&app)?;
    Ok(())
}

#[tauri::command]
pub fn analytics_db_size(
    app: tauri::AppHandle,
    state: tauri::State<'_, AnalyticsState>,
) -> Result<u64, AppError> {
    let path = state.resolve_path(&app)?;
    if !path.exists() {
        return Ok(0);
    }
    let meta = std::fs::metadata(&path)?;
    Ok(meta.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_roundtrip() {
        let event = AnalyticsEvent {
            ts: 1713500000000,
            kind: "message_sent".to_string(),
            project: Some("klaudex".to_string()),
            thread: None,
            detail: None,
            value: Some(42.0),
            value2: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        let restored: AnalyticsEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.ts, 1713500000000);
        assert_eq!(restored.kind, "message_sent");
        assert_eq!(restored.project.as_deref(), Some("klaudex"));
        assert!(restored.thread.is_none());
        assert_eq!(restored.value, Some(42.0));
    }

    #[test]
    fn serde_camel_case() {
        let event = AnalyticsEvent {
            ts: 100,
            kind: "session".to_string(),
            project: None,
            thread: None,
            detail: None,
            value: Some(3600.0),
            value2: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"ts\""));
        assert!(json.contains("\"kind\""));
        assert!(!json.contains("project")); // skipped when None
    }

    #[test]
    fn redb_write_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.redb");
        let db = Database::create(&path).unwrap();
        // Write
        let txn = db.begin_write().unwrap();
        {
            let mut table = txn.open_table(TABLE).unwrap();
            let event = AnalyticsEvent {
                ts: 1000,
                kind: "test".to_string(),
                project: None,
                thread: None,
                detail: Some("hello".to_string()),
                value: None,
                value2: None,
            };
            let bytes = serde_json::to_vec(&event).unwrap();
            let key = 1000u64 << 16; // shifted key format
            table.insert(key, bytes.as_slice()).unwrap();
        }
        txn.commit().unwrap();
        // Read
        let txn = db.begin_read().unwrap();
        let table = txn.open_table(TABLE).unwrap();
        let val = table.get(1000u64 << 16).unwrap().unwrap();
        let restored: AnalyticsEvent = serde_json::from_slice(val.value()).unwrap();
        assert_eq!(restored.kind, "test");
        assert_eq!(restored.detail.as_deref(), Some("hello"));
    }
}
