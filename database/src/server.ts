import express from "express";
import router from "./router";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(router);