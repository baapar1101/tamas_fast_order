import AqayePardakht from "../lib/aqayepardakht.js";

const pin = "2FBA8CE536FAFF26B3D2";
const aqayepardakht = AqayePardakht(pin);

aqayepardakht
  .Create({ amount: 10000, callback: "https://test.com/callback" })
  .then((response) => {
    console.log("Create Response:", response.data);
    if (response.data && response.data.status === "success") {
      console.log("StartPay URL:", aqayepardakht.StartPay(response.data.transid));
    }
  })
  .catch((err) => {
    console.error("Create Error:", err.response ? err.response.data : err.message);
  });
