export const pendingActionAttempt = {
  action_attempt_id: 'attempt1',
  action_type: 'UNLOCK_DOOR',
  status: 'pending',
  result: null,
  error: null,
}

export const successfulActionAttempt = {
  ...pendingActionAttempt,
  status: 'success',
  result: { device_id: 'device1' },
  completed_at: '2026-01-01T00:00:00Z',
}

export const failedActionAttempt = {
  ...pendingActionAttempt,
  status: 'error',
  error: { type: 'device_offline', message: 'The device is offline' },
}
