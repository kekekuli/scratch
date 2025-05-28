import request from "supertest";
import app from "../server";

describe("POST /addRecord", () => {
  it("should add a record and return 201", async () => {
    const res = await request(app)
      .post("/addRecord")
      .send({
        indicator: "GDP",
        date: "2024-05",
        value: 123.45
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.value).toBe(123.45);
  });

  it("should return 400 for invalid input", async () => {
    const res = await request(app)
      .post("/addRecord")
      .send({
        indicator: 123,
        date: "2024-05",
        value: "abc"
      });
    expect(res.status).toBe(400);
  });
});