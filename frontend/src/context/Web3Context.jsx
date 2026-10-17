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
  const [signer,       setSigner]       = useState(null);
  const [address,      setAddress]      = useState(null);
  const [chainId,      setChainId]      = useState(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roles,        setRoles]        = useState({ isAdmin: false, isVerifier: false, isSeller: false });
  const [contracts,    setContracts]    = useState({ cct: null, marketplace: null, registry: null });
  const [error,        setError]        = useState(null);

  // ── Ref so event listeners always see the latest isConnected value
  //    without needing to be re-registered on every state change ────────────
  const isConnectedRef = useRef(false);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

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

  // ── Instant Hackathon Demo Connect (No MetaMask Required) ────────────────
  const connectDemo = useCallback(() => {
    const demoAddr = '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc';
    setAddress(demoAddr);
    setChainId(11155111);
    setIsConnected(true);
    setRoles({ isSeller: true, isVerifier: true, isAdmin: true });
    toast.success('Connected in Instant Demo Mode! 🚀');
    return true;
  }, []);

  // ── Connect wallet (Direct MetaMask request with Demo fallback) ───────────
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      return connectDemo();
    }
    try {
      setIsConnecting(true);
      setError(null);

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        toast.error("No account authorized.");
        return false;
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer  = await web3Provider.getSigner();
      const userAddress = accounts[0];
      const network     = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
      setChainId(Number(network.chainId));
      setIsConnected(true);

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
      if (err.code === 4001 || (err.message && err.message.includes("User rejected"))) {
        toast.error("Wallet connection cancelled.");
      } else if (err.code === -32002 || (err.message && err.message.includes("already pending"))) {
        toast("MetaMask popup already open! Please check the fox icon.", { icon: "🦊" });
      } else {
        toast.error(err.message || "Failed to connect wallet");
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [initContracts, fetchRoles]);

  // ── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    setRoles({ isAdmin: false, isVerifier: false, isSeller: false });
    setContracts({ cct: null, marketplace: null, registry: null });
  }, []);

  // ── MetaMask event listeners — registered ONCE on mount ──────────────────
  // Using refs so handlers always see fresh values without re-subscribing.
  const connectRef    = useRef(connect);
  const disconnectRef = useRef(disconnect);
  useEffect(() => { connectRef.current    = connect;    }, [connect]);
  useEffect(() => { disconnectRef.current = disconnect; }, [disconnect]);

  useEffect(() => {
    if (!window.ethereum) return;

    // Increase max listeners to silence the MetaMask warning
    if (window.ethereum.setMaxListeners) {
      window.ethereum.setMaxListeners(20);
    }

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectRef.current();
      } else if (isConnectedRef.current) {
        // Account switched while connected — refresh connection
        await connectRef.current();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged",    handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged",    handleChainChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← Empty deps: register listeners ONCE only

  // ── Auto-connect if wallet was previously authorized ─────────────────────
  // Separate effect, also runs once on mount.
  useEffect(() => {
    if (!window.ethereum) return;
    let cancelled = false;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!cancelled && accounts.length > 0) connectRef.current();
      })
      .catch(() => {/* silently ignore */});

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← Once on mount

  // ── Read-only provider for public data ───────────────────────────────────
  const getReadOnlyContracts = useCallback(() => {
    if (!window.ethereum) return null;
    const p = new ethers.BrowserProvider(window.ethereum);
    return initContracts(p);
  }, [initContracts]);

  // ── Switch Network helper ────────────────────────────────────────────────
  const switchNetwork = useCallback(async (targetChainId = 11155111) => {
    if (!window.ethereum) return;
    const hexChainId = "0x" + targetChainId.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902 && targetChainId === 31337) {
        await window.ethereum.request({
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
  }, []);

  const value = {
    provider, signer, address, chainId,
    isConnected, isConnecting, error,
    roles, contracts,
    connect, connectDemo, disconnect, switchNetwork,
    getReadOnlyContracts,
    refreshRoles: () => fetchRoles(contracts.cct, address),
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside Web3Provider");
  return ctx;
}
