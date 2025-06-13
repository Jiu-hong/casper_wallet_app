import { useState, useEffect } from "react";
import { fetchDetail, fetchBalance } from "./api";

import {
  Args, CLValue,
  PublicKey,
  ContractCallBuilder,
  SessionBuilder,
  TransactionV1
} from "casper-js-sdk";

const NETWORKNAME = "casper-net-1"
// const NETWORKNAME = "casper-test"
const TTL = 1800000
const PATH_TO_CONTRACT = "contract.wasm"


function App() {
  // Always call hooks first

  const [activeKey, setActivePublicKey] = useState("");
  const [balance, setbalance] = useState("");
  const [message1, setMessage1] = useState("");
  const [message, setMessage] = useState("");
  const [deployhashnewModuleBytesDeploy, setDeployhashnewModuleBytesDeploy] = useState("");
  const [deployhashStoredContractByHash, setDeployhashStoredContractByHash] = useState("");
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

  // Fix: Detect if CasperWalletProvider is a function or object
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
      .byHash("95286e200f0b206c954e5386897092c40fb38a4fad56089b09e43a91e04185f0")
      .from(publicKey)
      .entryPoint("hello_world")
      .chainName(NETWORKNAME)
      .runtimeArgs(args)
      .ttl(TTL)
      .payment(2_500_000_000);

    const transaction = contractCall.build()
    // transaction.sign(privateKey);


    return transaction
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
      .payment(10_000_000_000)
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


    const transaction = await createStoredContractByHashDeploy(activeKey);
    const transactionJSON = transaction.toJSON()
    let signedTransaction;

    try {
      const res = await provider.sign(JSON.stringify(transactionJSON), activeKey);
      if (res.cancelled) {
        alert("Sign cancelled");
      } else {

        const signatureWithPrefix = get_signature_with_prefix(activeKey, res)
        signedTransaction = TransactionV1.setSignature(
          transaction,
          signatureWithPrefix,
          PublicKey.fromHex(activeKey)
        );
        // alert("Sign successful: " + JSON.stringify(signedDeploy, null, 2));
        console.log(
          "Sign successful: " + JSON.stringify(signedTransaction, null, 2)
        );
        const { data } = await fetchDetail(signedTransaction);

        setDeployhashStoredContractByHash(data);
      }
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const signnewModuleBytesTransaction = async () => {
    const transaction = await createnewModuleBytesDeploy(activeKey);
    const transactionJSON = transaction.toJSON()
    let signedTransaction;

    try {
      const res = await provider.sign(JSON.stringify(transactionJSON), activeKey);
      if (res.cancelled) {
        alert("Sign cancelled");
      } else {

        const signatureWithPrefix = get_signature_with_prefix(activeKey, res)
        signedTransaction = TransactionV1.setSignature(
          transaction,
          signatureWithPrefix,
          PublicKey.fromHex(activeKey)
        );
        // alert("Sign successful: " + JSON.stringify(signedDeploy, null, 2));
        console.log(
          "Sign successful: " + JSON.stringify(signedTransaction, null, 2)
        );
        const { data } = await fetchDetail(signedTransaction);

        setDeployhashnewModuleBytesDeploy(data);
      }
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const getBalance = async () => {
    if (!activeKey) return;
    try {
      const balance = await fetchBalance(activeKey);
      setbalance(balance); // or setbalance(balance.amount) if needed
    } catch (error) {
      // Show a user-friendly error message
      alert(error.error || "Failed to fetch balance");
      setbalance(""); // Optionally clear balance on error
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
          <label htmlFor="">
            message1
            <input
              type="text"
              value={message1}
              onChange={(e) => setMessage1(e.target.value)}
            />
            {message1}
          </label>

          <br />

          <div>
            <input
              type="submit"
              value="deploy"
              onClick={signDeployStoredContractByHash}
            />
            <hr />
          </div>

          {deployhashStoredContractByHash && (
            <div>transaction hash {deployhashStoredContractByHash}</div>
          )}
        </div>
      </div>
      <hr />
      <div>
        ======<strong>newModuleBytesDeploy</strong> ======
        <div>
          <label htmlFor="">
            message
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {message}
          </label>

          <br />

          <div>
            <input
              type="submit"
              value="deploy"
              onClick={signnewModuleBytesTransaction}
            />
            <hr />
          </div>

          {deployhashnewModuleBytesDeploy && (
            <div>transaction hash {deployhashnewModuleBytesDeploy}</div>
          )}
        </div>
      </div>
      <div>
        ====<strong>get balance</strong>====
        <div>
          <input type="submit" value="getBalance" onClick={getBalance} />
          {!activeKey && <div>please connect to signer</div>}
          {balance && <div>balance is {balance} motes</div>}
          <hr />
        </div>
      </div>
    </div>
  );
}

export default App;
