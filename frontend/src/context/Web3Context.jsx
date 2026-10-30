import { ethers } from "ethers";
import toast from "react-hot-toast";
import { CCT_ABI, MARKETPLACE_ABI, REGISTRY_ABI, CONTRACT_ADDRESSES } from "../contracts/config";

/**
 * Web3 Context — manages wallet connection, provider, signer, and contract instances.
 * Exposes helper hooks consumed throughout the app.
 */

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from "react";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider,     setProvider]     = useState(null);
  const [walletProvider, setWalletProvider] = useState(null);
  const [signer,       setSigner]       = useState(null);
  const [address,      setAddress]      = useState(null);
  const [chainId,      setChainId]      = useState(null);
  const [ethBalance,   setEthBalance]   = useState(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roles,        setRoles]        = useState({ isAdmin: false, isVerifier: false, isSeller: false });
  const [contracts,    setContracts]    = useState({ cct: null, marketplace: null, registry: null });
  const [error,        setError]        = useState(null);

  // ── Ref so event listeners always see the latest isConnected value
  //    without needing to be re-registered on every state change ────────────
  const isConnectedRef = useRef(false);
  const injectedProvidersRef = useRef([]);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  const getWalletOptions = useCallback(async () => {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const providers = [
      ...injectedProvidersRef.current.map(({ info, provider: injectedProvider }) => ({ info, provider: injectedProvider })),
      ...(window.ethereum?.providers || []).map((injectedProvider) => ({ provider: injectedProvider })),
      ...(window.ethereum ? [{ provider: window.ethereum }] : []),
    ].filter(({ provider: injectedProvider }, index, candidates) =>
      injectedProvider?.request && candidates.findIndex((candidate) => candidate.provider === injectedProvider) === index
    );

    return providers.map(({ info, provider: injectedProvider }, index) => {
      const metadataName = `${info?.name || ""} ${info?.rdns || ""} ${injectedProvider.wallet?.name || ""}`;
      const knownWallet = [
        [injectedProvider.isBrigadeKey || injectedProvider.isBrigade || /brigade/i.test(metadataName), "BrigadeKey"],
        [injectedProvider.isMetaMask, "MetaMask"],
        [injectedProvider.isBraveWallet, "Brave Wallet"],
        [injectedProvider.isCoinbaseWallet, "Coinbase Wallet"],
        [injectedProvider.isRabby, "Rabby Wallet"],
        [injectedProvider.isOkxWallet || injectedProvider.isOKXWallet, "OKX Wallet"],
      ].find(([matches]) => matches)?.[1];

      return {
        id: info?.uuid || `injected-wallet-${index}`,
        name: info?.name || knownWallet || `Browser Wallet ${index + 1}`,
        isBrigadeKey: /brigade/i.test(metadataName) || injectedProvider.isBrigadeKey || injectedProvider.isBrigade,
        provider: injectedProvider,
      };
    });
  }, []);

  useEffect(() => {
    const handleAnnounceProvider = (event) => {
      const { info, provider: injectedProvider } = event.detail || {};
      if (!info || !injectedProvider) return;
      injectedProvidersRef.current = [
        ...injectedProvidersRef.current.filter((item) => item.info.uuid !== info.uuid),
        { info, provider: injectedProvider },
      ];
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounceProvider);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounceProvider);
  }, []);

  // ── Initialize contracts ─────────────────────────────────────────────────
  const initContracts = useCallback((signerOrProvider) => {
    if (!signerOrProvider) return;
    const cct         = new ethers.Contract(CONTRACT_ADDRESSES.CCT,         CCT_ABI,         signerOrProvider);
    const marketplace = new ethers.Contract(CONTRACT_ADDRESSES.MARKETPLACE, MARKETPLACE_ABI, signerOrProvider);
    const registry    = new ethers.Contract(CONTRACT_ADDRESSES.REGISTRY,    REGISTRY_ABI,    signerOrProvider);
    setContracts({ cct, marketplace, registry });
    return { cct, marketplace, registry };
  }, []);

  // ── Fetch user roles ─────────────────────────────────────────────────────
  const fetchRoles = useCallback(async (cct, userAddress) => {
    if (!cct || !userAddress || CONTRACT_ADDRESSES.CCT === "0x0000000000000000000000000000000000000000") return;
    try {
      const { isAdmin, isVerifier, isSeller } = await cct.getRoles(userAddress);
      setRoles({ isAdmin, isVerifier, isSeller });
    } catch {
      // Contract not deployed yet — ignore
    }
  }, []);

  // ── Instant Hackathon Demo Connect ───────────────────────────────────────
  const connectDemo = useCallback(() => {
    const demoAddr = '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc';
    setAddress(demoAddr);
    setChainId(11155111);
    setEthBalance('10.0');
    setIsConnected(true);
    setRoles({ isSeller: true, isVerifier: true, isAdmin: true });
    toast.success('Connected in Instant Demo Mode! 🚀');
    return true;
  }, []);

  // ── Connect BrigadeKey through its injected EIP-1193 provider ─────────────
  const connect = useCallback(async (selectedProvider = null) => {
    try {
      setIsConnecting(true);
      setError(null);

      const walletOptions = await getWalletOptions();
      const injectedProvider = selectedProvider ||
        walletOptions.find((wallet) => wallet.isBrigadeKey)?.provider ||
        (walletOptions.length === 1 ? walletOptions[0].provider : null);

      if (!injectedProvider?.request) {
        throw new Error(walletOptions.length > 1
          ? "Select BrigadeKey from the detected browser wallets."
          : "BrigadeKey wallet not detected. Install or enable the BrigadeKey browser wallet.");
      }

      const accounts = await injectedProvider.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        toast.error("No account authorized.");
        return false;
      }

      const web3Provider = new ethers.BrowserProvider(injectedProvider);
      const web3Signer  = await web3Provider.getSigner();
      const userAddress = accounts[0];
      const network     = await web3Provider.getNetwork();

      setWalletProvider(injectedProvider);
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      try {
        const bal = await web3Provider.getBalance(userAddress);
        setEthBalance(ethers.formatEther(bal));
      } catch (balErr) {
        console.warn("Could not fetch balance:", balErr);
      }

      const c = initContracts(web3Signer);
      if (c) {
        try {
          await fetchRoles(c.cct, userAddress);
        } catch {
          // ignore contract call errors on unconnected/fresh networks
        }
      }
      toast.success("Wallet connected!");
      return true;
    } catch (err) {
      console.warn("Wallet connect error:", err);
      setError(err.message || "Failed to connect BrigadeKey wallet.");
      if (err.code === 4001 || (err.message && err.message.includes("User rejected"))) {
        toast.error("BrigadeKey connection cancelled.");
      } else if (err.code === -32002 || (err.message && err.message.includes("already pending"))) {
        toast("BrigadeKey wallet popup is already open. Please check your browser wallet.");
      } else {
        toast.error(err.message || "Failed to connect wallet");
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [initContracts, fetchRoles, getWalletOptions]);

  // ── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setProvider(null);
    setWalletProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setEthBalance(null);
    setIsConnected(false);
    setRoles({ isAdmin: false, isVerifier: false, isSeller: false });
    setContracts({ cct: null, marketplace: null, registry: null });
  }, []);

  // ── Keep the selected wallet's account and network in sync ────────────────
  const connectRef    = useRef(connect);
  const disconnectRef = useRef(disconnect);
  useEffect(() => { connectRef.current    = connect;    }, [connect]);
  useEffect(() => { disconnectRef.current = disconnect; }, [disconnect]);

  useEffect(() => {
    if (!walletProvider?.on) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectRef.current();
      } else if (isConnectedRef.current) {
        // Account switched while connected — refresh connection
        await connectRef.current(walletProvider);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    walletProvider.on("accountsChanged", handleAccountsChanged);
    walletProvider.on("chainChanged", handleChainChanged);

    return () => {
      walletProvider.removeListener("accountsChanged", handleAccountsChanged);
      walletProvider.removeListener("chainChanged",    handleChainChanged);
    };
  }, [walletProvider]);

  // ── Read-only provider for public data ───────────────────────────────────
  const getReadOnlyContracts = useCallback(() => {
    if (!walletProvider) return null;
    const p = new ethers.BrowserProvider(walletProvider);
    return initContracts(p);
  }, [initContracts, walletProvider]);

  // ── Switch Network helper ────────────────────────────────────────────────
  const switchNetwork = useCallback(async (targetChainId = 11155111) => {
    if (!walletProvider) return;
    const hexChainId = "0x" + targetChainId.toString(16);
    try {
      await walletProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902 && targetChainId === 31337) {
        await walletProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x7a69",
            chainName: "Localhost 8545",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          }],
        });
      }
    }
  }, [walletProvider]);

  const value = {
    provider, signer, address, chainId, ethBalance,
    isConnected, isConnecting, error,
    roles, contracts,
    connect, connectDemo, disconnect, switchNetwork, getWalletOptions,
    getReadOnlyContracts,
    refreshRoles: () => fetchRoles(contracts.cct, address),
    refreshBalance: async () => {
      if (provider && address) {
        const bal = await provider.getBalance(address);
        setEthBalance(ethers.formatEther(bal));
      }
    },
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
}
