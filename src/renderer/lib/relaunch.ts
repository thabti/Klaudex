/**
 * Pre-relaunch helper — flushes all persisted state to disk and creates
 * a backup before the process is killed during an update.
 */
import * as historyStore from '@/lib/history-store'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'

/** Flush state and create backup. Call before every relaunch(). */
export const prepareForRelaunch = async (): Promise<void> => {
  useTaskStore.getState().persistHistory()
  await historyStore.flush()
  await historyStore.createBackup(useSettingsStore.getState().settings)
}
