export function assertTrustedIpcSender(
  actualWebContentsId: number,
  shellWebContentsId: number | undefined
): void {
  if (
    shellWebContentsId === undefined ||
    actualWebContentsId !== shellWebContentsId
  ) {
    throw new Error('Rejected IPC call from an untrusted web contents')
  }
}
