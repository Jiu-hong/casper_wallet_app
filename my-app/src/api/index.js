import { RpcClient, HttpHandler, Transaction, PublicKey, PurseIdentifier } from "casper-js-sdk";

// Create RPC client for direct communication with Casper network
const rpcClient = new RpcClient(
  new HttpHandler("/rpc") // This will use the proxy configured in vite.config.js
);

export const fetchDetail = async (signedTransaction) => {
  try {
    // Submit the signed transaction directly to the Casper network
    console.log("Submitting transaction:", signedTransaction);

    const result = await rpcClient.putTransaction(signedTransaction);
    console.log("Transaction submission result:", JSON.stringify(result));

    // Handle different possible response formats
    if (result && result.transactionHash) {
      return { data: JSON.stringify(result.transactionHash) };
    } else {
      console.warn("Unexpected result format:", result);
      return { data: String(result) };
    }
  } catch (error) {
    console.error("Error submitting transaction:", JSON.stringify(error));

    // Extract detailed error information for the frontend
    let errorMessage = "Failed to submit transaction";
    let errorDetails = "";

    if (error.response && error.response.data) {
      // If it's an HTTP error with response data
      errorDetails = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
    } else if (error.message) {
      // If it's a standard error with message
      errorDetails = error.message;
    } else if (typeof error === 'string') {
      errorDetails = error;
    } else {
      // If it's an unknown error format
      errorDetails = JSON.stringify(error);
    }

    throw {
      error: errorMessage,
      details: errorDetails,
      fullError: error // Include full error for debugging
    };
  }
};

export const fetchBalance = async (publicKeyHex) => {
  console.log("Fetching balance for publicKey:", publicKeyHex);
  try {
    // Get account balance directly from Casper network
    const publicKey = PublicKey.fromHex(publicKeyHex);
    const purseIdentifier = PurseIdentifier.fromPublicKey(publicKey);
    console.log("purseIdentifier", purseIdentifier);

    const balance = await rpcClient.queryLatestBalance(purseIdentifier);
    console.log("Balance query result:", balance);

    // Handle the response format similar to the server implementation
    if (balance && balance.rawJSON && balance.rawJSON.balance) {
      return balance.rawJSON.balance;
    } else if (balance && typeof balance === 'object') {
      return balance.balance || balance.amount || balance;
    }

    return balance;
  } catch (error) {
    console.error("Error fetching balance:", error);

    // Extract detailed error information for the frontend
    let errorMessage = "Failed to fetch balance";
    let errorDetails = "";

    if (error.response && error.response.data) {
      // If it's an HTTP error with response data
      errorDetails = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
    } else if (error.message) {
      // If it's a standard error with message
      errorDetails = error.message;
    } else if (typeof error === 'string') {
      errorDetails = error;
    } else {
      // If it's an unknown error format
      errorDetails = JSON.stringify(error);
    }

    throw {
      error: errorMessage,
      details: errorDetails,
      fullError: error // Include full error for debugging
    };
  }
};
