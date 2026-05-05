/**
 * Connection health monitoring for the ACP backend subprocess.
 *
 * Inspired by T3 Code's WsTransport heartbeat pattern. While Tauri IPC
 * doesn't have network-level disconnections, the kiro-cli subprocess can
 * crash or become unresponsive. This module provides:
 *
 * - Periodic health checks via a lightweight IPC probe
 * - Automatic reconnection attempts with exponential backoff
 * - Connection state tracking for UI indicators
 */

import { ipc } from '@/lib/ipc'
import { useTaskStore } from '@/stores/taskStore'

export interface ConnectionHealthConfig {
  /** Interval between health checks in ms (default: 10000) */
  checkIntervalMs?: number
  /** Maximum number of consecutive failures before giving up (default: 5) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseRetryDelayMs?: number
  /** Maximum backoff delay in ms (default: 30000) */
  maxRetryDelayMs?: number
}

export interface ConnectionHealthState {
  /** Whether the backend is currently reachable */
  healthy: boolean
  /** Number of consecutive failed health checks */
  consecutiveFailures: number
  /** Timestamp of last successful health check */
  lastHealthyAt: number
  /** Whether a reconnection attempt is in progress */
  reconnecting: boolean
}

const DEFAULT_CONFIG: Required<ConnectionHealthConfig> = {
  checkIntervalMs: 10_000,
  maxRetries: 5,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 30_000,
}

/**
 * Calculate exponential backoff delay with jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  const clampedDelay = Math.min(exponentialDelay, maxDelayMs)
  // Add ±25% jitter to prevent thundering herd
  const jitter = clampedDelay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(clampedDelay + jitter))
}

/**
 * Start monitoring connection health.
 * Returns a cleanup function to stop monitoring.
 */
export function startConnectionHealthMonitor(
  config: ConnectionHealthConfig = {},
): () => void {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  let intervalId: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const state: ConnectionHealthState = {
    healthy: true,
    consecutiveFailures: 0,
    lastHealthyAt: Date.now(),
    reconnecting: false,
  }

  const checkHealth = async () => {
    if (stopped || state.reconnecting) return

    try {
      // Use listTasks as a lightweight health probe
      await ipc.listTasks()
      // Success: reset failure counter
      state.healthy = true
      state.consecutiveFailures = 0
      state.lastHealthyAt = Date.now()
      if (!useTaskStore.getState().connected) {
        useTaskStore.getState().setConnected(true)
      }
    } catch {
      // Failure: increment counter
      state.consecutiveFailures++
      state.healthy = false

      if (state.consecutiveFailures >= cfg.maxRetries) {
        // Too many failures — mark as disconnected
        useTaskStore.getState().setConnected(false)
      } else {
        // Attempt reconnection with backoff
        state.reconnecting = true
        const delay = calculateBackoffDelay(
          state.consecutiveFailures - 1,
          cfg.baseRetryDelayMs,
          cfg.maxRetryDelayMs,
        )
        await sleep(delay)
        if (!stopped) {
          try {
            await ipc.listTasks()
            state.healthy = true
            state.consecutiveFailures = 0
            state.lastHealthyAt = Date.now()
            useTaskStore.getState().setConnected(true)
          } catch {
            // Still failing — will retry on next interval
          }
        }
        state.reconnecting = false
      }
    }
  }

  // Start periodic checks
  intervalId = setInterval(checkHealth, cfg.checkIntervalMs)

  return () => {
    stopped = true
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
