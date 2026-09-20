import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setDeferred(null);
  };

  if (!deferred || installed) return null;

  return (
    <div className="install-banner" role="dialog" aria-live="polite">
      <div className="install-banner-icon">
        <Icon name="mobile" />
      </div>
      <div className="install-banner-copy">
        <strong>نصب اپلیکیشن تماس مارکت</strong>
        <span>دسترسی سریع‌تر از صفحه اصلی گوشی</span>
      </div>
      <button type="button" className="install-banner-btn" onClick={() => void install()}>
        نصب
      </button>
    </div>
  );
}