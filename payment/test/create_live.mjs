import AqayePardakhtApi from "../lib/aqayepardakht.js";

const pin = process.env.AQAYEPARDAKHT_PIN;
if (!pin) {
  console.error("NO_PIN");
  process.exit(2);
}

const gw = AqayePardakhtApi(pin);
try {
  const res = await gw.Create({
    amount: 1000,
    callback: "https://tamas-fast-order.ir/payment/callback",
  });
  console.log("CREATE_STATUS", res?.status);
  console.log("CREATE_BODY", JSON.stringify(res?.data));
} catch (err) {
  console.log(
    "CREATE_ERR",
    err?.response?.status,
    JSON.stringify(err?.response?.data ?? err?.message),
  );
  process.exitCode = 1;
}