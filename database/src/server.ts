import express from "express";
import router from "./router";

const app = express();
app.use(express.json()); // 建议加上
app.use(router);

if (require.main === module) {
  const PORT = process.env.EXPRESS_PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;