// Estado compartido del prompt de instalación PWA (lo llena plugins/pwa.client.ts).
export function useInstallPrompt() {
  const deferred = useState<any>('pwa-deferred', () => null)
  const canInstall = useState<boolean>('pwa-can-install', () => false)
  return { deferred, canInstall }
}
