import axios from "axios";

export const host = "http://localhost:9000";

export const API = axios.create({ baseURL: host });

export const fetchDetail = async (signedTransactionJSON) =>
  API.post(host + "/", { signedTransactionJSON: signedTransactionJSON });

export const fetchBalance = async (publicKey) => {
  try {
    const response = await API.post("/balance", { publicKeyHex: publicKey });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      throw error.response.data;
    }
    throw { error: "Network error", details: error.message };
  }
};
