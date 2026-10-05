import AqayePardakhtApi from "../lib/aqayepardakht.js";

const pin = process.env.TEST_PAYMENT_PIN;
if (!pin) {
  console.error("TEST_PAYMENT_PIN env missing");
  process.exit(2);
}

const gateway = AqayePardakhtApi(pin);
try {
  const { Create } = gateway;
  const res = await Create({
    amount: 1000,
    callback: "https://tamas-fast-order.ir/payment/callback",
  });
  console.log("CREATE_STATUS", res?.status);
  console.log("CREATE_NUMERIC_BODY", JSON.stringify(res?.data));
} catch (err) {
  console.error("CREATE_ERR", err?.response?.status, JSON.stringify(err?.response?.data ?? err?.message));
  process.exitCode = 1;
}