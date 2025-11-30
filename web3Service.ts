
// Minimal interface for window.ethereum
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (...args: any[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
}

export const isMetaMaskInstalled = (): boolean => {
  const { ethereum } = window as any;
  return Boolean(ethereum && ethereum.isMetaMask);
};

export const connectWallet = async (): Promise<string> => {
  let provider = (window as any).ethereum;
  const rabby = (window as any).rabby || ((window as any).ethereum && (window as any).ethereum.isRabby ? (window as any).ethereum : null);

  console.log("Initiating wallet connection...");

  // Fallback for users without a wallet (Demo Mode)
  // We check if provider is undefined. If so, we seamlessly switch to Demo Mode without scary alerts.
  if (!provider) {
    console.log("No crypto wallet found. Switching to Demo Mode.");

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const demoAddress = "0xDemoUser...8888";
    // Persist demo state so we can auto-connect on reload
    localStorage.setItem("demo_wallet_connected", "true");

    // Inform user gently via return, App.tsx handles the UI
    return demoAddress;
  }

  // Handle multiple wallets (EIP-6963 / Injection Conflict)
  if (rabby) {
    provider = rabby;
  } else if (provider.providers && Array.isArray(provider.providers)) {
    const rabbyP = provider.providers.find((p: any) => p.isRabby);
    const metaMask = provider.providers.find((p: any) => p.isMetaMask);
    provider = rabbyP || metaMask || provider.providers[0];
  }

  try {
    console.log("Requesting eth_requestAccounts...");
    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned.");
    }

    console.log("Connected:", accounts[0]);
    return accounts[0];
  } catch (error: any) {
    console.error("Wallet connection error:", error);
    if (error.code === 4001) {
      throw new Error("Connection cancelled.");
    }
    throw new Error("Failed to connect wallet.");
  }
};

export const checkIfWalletIsConnected = async (): Promise<string | null> => {
  // Check demo mode first
  if (localStorage.getItem("demo_wallet_connected") === "true") {
    return "0xDemoUser...8888";
  }

  let provider = (window as any).ethereum;
  const rabby = (window as any).rabby || ((window as any).ethereum && (window as any).ethereum.isRabby ? (window as any).ethereum : null);

  if (!provider) return null;

  if (rabby) {
    provider = rabby;
  } else if (provider.providers && Array.isArray(provider.providers)) {
    const rabbyP = provider.providers.find((p: any) => p.isRabby);
    const metaMask = provider.providers.find((p: any) => p.isMetaMask);
    provider = rabbyP || metaMask || provider.providers[0];
  }

  try {
    // Some wallets might not support eth_accounts without permission, but most do return empty array
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      return accounts[0];
    }
  } catch (error) {
    console.error("Error checking wallet connection", error);
  }
  return null;
};

export const listenToAccountChanges = (callback: (account: string | null) => void) => {
  const { ethereum } = window as any;
  if (ethereum) {
    try {
      ethereum.on('accountsChanged', (accounts: string[]) => {
        callback(accounts.length > 0 ? accounts[0] : null);
      });
    } catch (e) {
      console.warn("Could not subscribe to account changes", e);
    }
  }
};

export const ensureBaseNetwork = async (): Promise<boolean> => {
  const provider = (window as any).ethereum as EthereumProvider | undefined;
  if (!provider) return false;
  try {
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    if (chainIdHex === '0x2105') return true;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      return true;
    } catch {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org']
          }]
        });
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
};

export const connectWithMetaMask = async (): Promise<string> => {
  const eth: any = (window as any).ethereum;
  let provider = eth;
  if (!provider) {
    throw new Error("No wallet found");
  }
  if (provider.providers && Array.isArray(provider.providers)) {
    const metaMask = provider.providers.find((p: any) => p.isMetaMask);
    provider = metaMask || provider;
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned");
  return accounts[0];
};

export const connectWithCoinbase = async (): Promise<string> => {
  const eth: any = (window as any).ethereum;
  let provider = eth;
  if (!provider) {
    throw new Error("No wallet found");
  }
  if (provider.providers && Array.isArray(provider.providers)) {
    const coinbase = provider.providers.find((p: any) => p.isCoinbaseWallet);
    provider = coinbase || provider;
  } else if ((provider as any).isCoinbaseWallet) {
    provider = provider;
  }
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned");
  return accounts[0];
};
