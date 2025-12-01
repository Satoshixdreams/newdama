
import sdk from '@farcaster/frame-sdk';

export const notifyFarcasterAppReady = async () => {
  try {
    // Inform the Farcaster client that the frame is ready to be displayed
    await sdk.actions.ready();
  } catch (e) {
    console.debug("Farcaster SDK ready call failed (likely not in a frame)", e);
  }
};

export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export const getFarcasterContext = async (): Promise<FarcasterUser | null> => {
  // 1. Check URL Params for testing (e.g. ?fid=123)
  const params = new URLSearchParams(window.location.search);
  const mockFid = params.get('fid');
  if (mockFid) {
    console.log("Using Mock FID from URL:", mockFid);
    return {
      fid: parseInt(mockFid),
      username: `user${mockFid}`,
      displayName: `User ${mockFid}`,
      pfpUrl: `https://avatar.vercel.sh/${mockFid}`
    };
  }

  try {
    // 2. Race the SDK context promise against a timeout to prevent hanging
    const contextPromise = sdk.context;
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1000));

    const context = await Promise.race([contextPromise, timeoutPromise]) as any;

    if (context && context.user) {
      return {
        fid: context.user.fid,
        username: context.user.username,
        displayName: context.user.displayName,
        pfpUrl: context.user.pfpUrl
      };
    }
    return null;
  } catch (e) {
    console.debug("Failed to get Farcaster context", e);
    return null;
  }
};

export const signIn = async (nonce: string): Promise<any> => {
  try {
    const result = await sdk.actions.signIn({ nonce });
    return result;
  } catch (e) {
    console.error("Farcaster Sign In failed", e);
    return null;
  }
};

export const openExternalUrl = (url: string) => {
  try {
    sdk.actions.openUrl(url);
  } catch (e) {
    console.warn("SDK openUrl failed, falling back to window.open", e);
    window.open(url, '_blank');
  }
};

export const addMiniAppAndEnableNotifications = async (): Promise<{ token?: string; url?: string; added: boolean }> => {
  try {
    const anySdk: any = sdk as any;
    const res = (anySdk.actions.addMiniApp ? await anySdk.actions.addMiniApp() : await anySdk.actions.addFrame());
    if (res && res.added) {
      const ctx: any = await sdk.context;
      const details = ctx?.client?.notificationDetails;
      if (details?.token && details?.url) {
        localStorage.setItem('fc_notification_token', details.token);
        localStorage.setItem('fc_notification_url', details.url);
      }
      return { token: details?.token, url: details?.url, added: true };
    }
    return { added: false };
  } catch {
    return { added: false };
  }
};

export const sendSelfNotification = async (title: string, body: string, targetUrl: string): Promise<boolean> => {
  try {
    const url = localStorage.getItem('fc_notification_url');
    const token = localStorage.getItem('fc_notification_token');
    if (!url || !token) return false;
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, token, title, body, targetUrl })
    });
    return res.ok;
  } catch {
    return false;
  }
};
