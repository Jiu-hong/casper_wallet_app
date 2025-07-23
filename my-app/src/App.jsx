import { useState, useEffect } from "react";
import { fetchDetail, fetchBalance } from "./api";
import ErrorBoundary from "./ErrorBoundary";

import {
  Args, CLValue,
  PublicKey,
  ContractCallBuilder,
  SessionBuilder,
  NativeTransferBuilder,
  TransactionV1
} from "casper-js-sdk";

// const NETWORKNAME = "casper-net-1"
const NETWORKNAME = "casper-test"
const TTL = 1800000
// const PATH_TO_CONTRACT = "contract.wasm"
const PATH_TO_CONTRACT = "contract.wasm"


function App() {
  // Always call hooks first
  const [activeKey, setActivePublicKey] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setbalance] = useState("");
  const [message1, setMessage1] = useState("");
  const [message, setMessage] = useState("");
  const [contractHash,setContractHash] = useState("")
  const [deployhashnewModuleBytesDeploy, setDeployhashnewModuleBytesDeploy] = useState("");
  const [deployhashStoredContractByHash, setDeployhashStoredContractByHash] = useState("");
  const [deployhashNativeTransfer, setDeployhashNativeTransfer] = useState("");
  const [walletDetected, setWalletDetected] = useState(false);
  const [eventTypes, setEventTypes] = useState(null);

  // Detect Casper Wallet extension after page load
  useEffect(() => {
    function detectWallet() {
      if (window.CasperWalletProvider && window.CasperWalletEventTypes) {
        setWalletDetected(true);
        setEventTypes(window.CasperWalletEventTypes);
      } else {
        setWalletDetected(false);
        setEventTypes(null);
      }
    }
    detectWallet();
    // Listen for extension injection (in case it loads after page)
    const interval = setInterval(detectWallet, 1000);
    return () => clearInterval(interval);
  }, []);

  const provider =
    typeof window.CasperWalletProvider === "function"
      ? window.CasperWalletProvider()
      : window.CasperWalletProvider;

  const connectToCasperWallet = async () => {
    if (!provider || typeof provider.requestConnection !== "function") {
      alert("Casper Wallet extension not found or provider is invalid.");
      return;
    }
    return provider.requestConnection();
  };

  const switchAccount = async () => {
    if (!provider || typeof provider.requestSwitchAccount !== "function") {
      alert("Casper Wallet extension not found or provider is invalid.");
      return;
    }
    return provider.requestSwitchAccount();
  };

  const createStoredContractByHashDeploy = async (publicKeyHex) => {
    const publicKey = PublicKey.fromHex(publicKeyHex);

    const args = Args.fromMap({
      message1: CLValue.newCLString(message1)
    });
    const contractCall = new ContractCallBuilder()
      .byHash(contractHash)
      .from(publicKey)
      .entryPoint("hello_world")
      .chainName(NETWORKNAME)
      .runtimeArgs(args)
      .ttl(TTL)
      .payment(2_500_000_000);

    const transaction = contractCall.build()

    return transaction
  };

  const createNativeTransfer = async (publicKeyHex) => {
    if (!publicKeyHex) {
      throw new Error("Public key is required");
    }
    if (!targetAccount) {
      throw new Error("Target account is required");
    }
    if (!amount || isNaN(amount)) {
      throw new Error("Valid amount is required");
    }

    try {
      const publicKey = PublicKey.fromHex(publicKeyHex);
      const targetPublicKey = PublicKey.fromHex(targetAccount);

      const transaction = new NativeTransferBuilder()
        .from(publicKey)
        .target(targetPublicKey)
        .amount(BigInt(amount)) // Convert to BigInt for proper handling
        .id(Date.now())
        .chainName(NETWORKNAME)
        .payment(100_000_000)
        .build();
        
      return transaction;
    } catch (error) {
      console.error("Error creating native transfer:", error);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
  };

  const createnewModuleBytesDeploy = async (publicKeyHex) => {
    const publicKey = PublicKey.fromHex(publicKeyHex);
    const args = Args.fromMap({
      message: CLValue.newCLString(
        message
      )
    });

    let wasmBytes
    await fetch(PATH_TO_CONTRACT)
      .then((response) => response.arrayBuffer())
      .then((bytes) => (wasmBytes = new Uint8Array(bytes)));

    const sessionWasm = new SessionBuilder()
      .from(publicKey)
      .chainName(NETWORKNAME)
      .payment(20_000_000_000)
      .ttl(TTL)
      .wasm(wasmBytes)
      .installOrUpgrade()
      .runtimeArgs(args);
    const transaction = sessionWasm.build()

    return transaction
  };

   const get_signature_with_prefix = (activeKey, res) => {
    const publicKeyBytes = PublicKey.fromHex(activeKey).key.bytes();

    // if length 32, 01.
    // if length 33, 02
    let prefix;
    if (publicKeyBytes.length === 32) {
      prefix = 0x01;
    } else if (publicKeyBytes.length === 33) {
      prefix = 0x02;
    } else {
      throw new Error("Unexpected publicKeyBytes length: " + publicKeyBytes.length);
    }

    // Add prefix to signature (Uint8Array)
    const signatureWithPrefix = new Uint8Array(res.signature.length + 1);

    signatureWithPrefix[0] = prefix;

    signatureWithPrefix.set(res.signature, 1);


    return signatureWithPrefix

  }
  const signDeployStoredContractByHash = async () => {
    try {
      const transaction = await createStoredContractByHashDeploy(activeKey);
      const transaction_hash = await signAndDeploy(transaction);
      if (transaction_hash) {
        setDeployhashStoredContractByHash(transaction_hash);
      }
    } catch (err) {
      console.error("Error in signDeployStoredContractByHash:", err);
      
      // Show the complete error object for debugging
      const errorMessage = JSON.stringify(err, null, 2);
      
      alert("Contract Deployment Error: " + errorMessage);
    }
  };

  const signAndDeploy = async (transaction) => {
    const transactionJSON = transaction.toJSON()
    let signedTransaction;

    try { 
      const res = await provider.sign(JSON.stringify(transactionJSON), activeKey);
      if (res.cancelled) {
        alert("Sign cancelled");
        return null;
      } else {
        const signatureWithPrefix = get_signature_with_prefix(activeKey, res)
        signedTransaction = TransactionV1.setSignature(
          transaction,
          signatureWithPrefix,
          PublicKey.fromHex(activeKey)
        );
        console.log(
          "Sign successful: " + JSON.stringify(signedTransaction, null, 2)
        );
        const { data } = await fetchDetail(signedTransaction);
        console.log("data:",data)

        return data;
      }
    }
    catch (err) {
      console.error("Error in signAndDeploy:", JSON.stringify(err));
      
      // Show the complete error object for debugging
      const errorMessage = JSON.stringify(err, null, 2);
      
      alert("Transaction Error: " + errorMessage);
      throw err;
    }
  }
  const signNativeTransfer = async () => {
    if (!activeKey) {
      alert("Please connect to your wallet first");
      return;
    }
    if (!targetAccount) {
      alert("Please enter a target account");
      return;
    }
    if (!amount) {
      alert("Please enter an amount");
      return;
    }
    
    try {
      console.log("Creating native transfer transaction...");
      const transaction = await createNativeTransfer(activeKey);
      
      console.log("Signing and deploying transaction...");
      const transaction_hash = await signAndDeploy(transaction);
      
      if (transaction_hash && transaction_hash !== null) {
        console.log("Transaction successful:", transaction_hash);
        setDeployhashNativeTransfer(String(transaction_hash));
      } else {
        console.warn("Transaction was cancelled or failed");
      }
    } catch (err) {
      console.error("Error in signNativeTransfer:", err);
      
      // Show the complete error object for debugging
      const errorMessage = JSON.stringify(err, null, 2);
      
      alert("Native Transfer Error: " + errorMessage);
      // Don't update state on error to prevent React errors
    }
  };
  
  const signnewModuleBytesTransaction = async () => {
    try {
      const transaction = await createnewModuleBytesDeploy(activeKey);
      const transaction_hash = await signAndDeploy(transaction);
      if (transaction_hash) {
        setDeployhashnewModuleBytesDeploy(transaction_hash);
      }
    } catch (err) {
      console.error("Error in signnewModuleBytesTransaction:", err);
      
      // Show the complete error object for debugging
      const errorMessage = JSON.stringify(err, null, 2);
      
      alert("Module Deployment Error: " + errorMessage);
    }
  };

  const getBalance = async () => {
    if (!activeKey) {
      console.warn("No active key available for balance fetch");
      return;
    }
    try {
      const balanceResult = await fetchBalance(activeKey);
      console.log("Balance result:", balanceResult);
      
      // Ensure we're setting a string value for display
      if (balanceResult !== null && balanceResult !== undefined) {
        const balanceValue = typeof balanceResult === 'object' 
          ? (balanceResult.balance || balanceResult.amount || JSON.stringify(balanceResult))
          : String(balanceResult);
        setbalance(balanceValue);
      } else {
        setbalance("0");
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      
      // Show the complete error object for debugging
      const errorMessage = JSON.stringify(error, null, 2);
      
      alert("Balance Error: " + errorMessage);
      setbalance(""); // Clear balance on error
    }
  };

  useEffect(() => {
    if (!walletDetected || !eventTypes) return;
    const handleConnected = (event) => {
      try {
        const state = JSON.parse(event.detail);
        if (state.activeKey) {
          setActivePublicKey(state.activeKey);
        }
      } catch (err) {
        console.log(err);
      }
    };
    const handleActiveKeyChanged = async (event) => {
      try {
        const state = JSON.parse(event.detail);
        if (state.activeKey) {
          setActivePublicKey(state.activeKey);
        }
        console.log('ActiveKeyChanged: "casper-wallet:activeKeyChanged"');
      } catch (err) {
        console.log(err);
      }
    };

    const handleDisconnected = async (event) => {
      setActivePublicKey("");
      try {
        const state = JSON.parse(event.detail);
        console.log(state);
        console.log('ActiveKeyChanged: "casper-wallet:activeKeyChanged"');
      } catch (err) {
        console.log(err);
      }
    };

    const handleTabChanged = async (event) => {
      try {
        const state = JSON.parse(event.detail);
        console.log(state);
        console.log('TabChanged: "casper-wallet:tabChanged"');
      } catch (err) {
        console.log(err);
      }
    };

    const handleLocked = async (event) => {
      try {
        const state = JSON.parse(event.detail);
        console.log(state);
        console.log('Locked: "casper-wallet:locked"');
      } catch (err) {
        console.log(err);
      }
    };

    const handleUnlocked = async (event) => {
      try {
        const state = JSON.parse(event.detail);
        console.log(state);
        console.log('Unlocked: "casper-wallet:unlocked"');
      } catch (err) {
        console.log(err);
      }
    };
    window.addEventListener(eventTypes.Connected, handleConnected);
    window.addEventListener(eventTypes.Disconnected, handleDisconnected);
    window.addEventListener(eventTypes.TabChanged, handleTabChanged);
    window.addEventListener(eventTypes.ActiveKeyChanged, handleActiveKeyChanged);
    window.addEventListener(eventTypes.Locked, handleLocked);
    window.addEventListener(eventTypes.Unlocked, handleUnlocked);

    return () => {
      window.removeEventListener(eventTypes.Connected, handleConnected);
    };
  }, [
    walletDetected,
    eventTypes,
    setActivePublicKey,
    eventTypes && eventTypes.ActiveKeyChanged,
    eventTypes && eventTypes.Connected,
    eventTypes && eventTypes.Disconnected,
    eventTypes && eventTypes.Locked,
    eventTypes && eventTypes.TabChanged,
    eventTypes && eventTypes.Unlocked,
  ]);

  if (!walletDetected) {
    return (
      <div style={{ color: 'red', padding: '2rem' }}>
        Casper Wallet extension not detected. Please install or enable it.<br />
        If you just installed it, refresh this page.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        <div>
          <button onClick={connectToCasperWallet}>
            {" "}
            connect to Casper Wallet
          </button>{" "}
          <button onClick={switchAccount}>switch account</button>
          <div>Public key</div>
          <div> {activeKey}</div>
        </div>
        <hr />
      <div>
        ======<strong>StoredContractByHash</strong> ======
        <div>
          <label htmlFor="" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '1em' }}>
            contract hash
            <input
              type="text"
              value={contractHash}
              onChange={(e) => setContractHash(e.target.value)}
              style={{ width: '500px' }}
              placeholder="Enter contract hash here"
            />
          </label>
          <div style={{ textAlign: 'left', marginLeft: '2px' }}>{contractHash}</div>
          <br />
          <label htmlFor="" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '1em' }}>
            message1
            <input
              type="text"
              value={message1}
              onChange={(e) => setMessage1(e.target.value)}
              placeholder="Enter message here"
            />
            {message1}
          </label>
          <div>
            <input
              type="submit"
              value="deploy"
              onClick={signDeployStoredContractByHash}
            />

          {deployhashStoredContractByHash && (
            <div>transaction hash {deployhashStoredContractByHash}</div>
            )}
          <br />
          </div>
        </div>
      </div>
      <hr />
      <div>
        ======<strong>Native Transfer</strong> ======
        <div>
          <label htmlFor="" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '1em' }}>
            target account
            <input
              type="text"
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value)}
              style={{ width: '500px' }}
              placeholder="Enter target account here"
            />
          </label>
          <div style={{ textAlign: 'left', marginLeft: '2px' }}>{targetAccount}</div>
          <br />
          <label htmlFor="" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '1em' }}>
            amount
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter transfer amount here"
            />
            {amount}
          </label>
          <div>
            <input
              type="submit"
              value="deploy"
              onClick={signNativeTransfer}
            />

          {deployhashNativeTransfer && (
            <div>transaction hash {typeof deployhashNativeTransfer === 'string' ? deployhashNativeTransfer : String(deployhashNativeTransfer)}</div>
            )}
          <br />
          </div>
        </div>
      </div>
      <hr />
      <div>
        ======<strong>newModuleBytesDeploy</strong> ======
        <div>
          <label htmlFor="" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '1em' }}>
            message
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message here"
            />
            {message}
          </label>

          {/* <br /> */}

          <div>
            <input
              type="submit"
              value="deploy"
              onClick={signnewModuleBytesTransaction}
            />

          {deployhashnewModuleBytesDeploy && (
            <div>transaction hash {deployhashnewModuleBytesDeploy}</div>
            )}
            <br/>
          </div>
            <hr />

        </div>
      </div>
      <div>
        ====<strong>get balance</strong>====
        <div>
          <input type="submit" value="getBalance" onClick={getBalance} />
          {!activeKey && <div>please connect to signer</div>}
          {balance && (
            <div>balance is {typeof balance === 'string' ? balance : String(balance)} motes</div>
          )}
          <hr />
        </div>
      </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
