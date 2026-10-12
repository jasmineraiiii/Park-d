import mongoose from "mongoose";
import { ENV } from "./config.js";

export async function connectDb(uri = ENV.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const { host, name } = mongoose.connection;
  console.log(`[db] connected to ${host}/${name}`);
  return mongoose.connection;
}
