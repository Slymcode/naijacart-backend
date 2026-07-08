require("dotenv").config();
const axios = require("axios");
(async () => {
  try {
    const apiUrl = "http://localhost:3000";
    const signIn = await axios.post(`${apiUrl}/auth/signin`, {
      email: "admin@sellrush.com",
      password: "admin123",
    });
    const token = signIn.data.accessToken;
    console.log("TOKEN:", token.slice(0, 20) + "...");

    const payload = {
      affiliateCode: "AFF-1779679821731-JNWD6D-fine-hair",
      items: [
        { productId: "cmr6ekxth000192p2r29uvvfv", quantity: 1 },
        { productId: "cmr56z1sw00014wwl0f81y1zz", quantity: 1 },
      ],
      shippingAddress: "dsf",
      shippingCity: "sdf",
      shippingCountry: "Nigeria",
      shippingState: "sdf",
      shippingZipCode: "fdsf",
    };

    const orderResponse = await axios.post(`${apiUrl}/orders`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    console.log("ORDER RESPONSE:", orderResponse.status, orderResponse.data);
  } catch (err) {
    if (err.response) {
      console.error("ERROR RESPONSE STATUS:", err.response.status);
      console.error(
        "ERROR RESPONSE DATA:",
        JSON.stringify(err.response.data, null, 2),
      );
    } else {
      console.error("ERROR:", err.message);
      console.error(err.stack);
    }
    process.exit(1);
  }
})();
