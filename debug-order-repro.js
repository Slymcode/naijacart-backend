require("dotenv").config();
const axios = require("axios");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function ensureUser() {
  const email = "debug-user@sellrush.com";
  const password = "debug1234";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hashedPassword = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: "Debug",
        lastName: "User",
        role: "CUSTOMER",
        isActive: true,
      },
    });
    console.log("Created debug user:", email);
  } else {
    console.log("Debug user already exists:", email);
  }
  return { email, password };
}

async function checkProducts(ids) {
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, price: true, sellerId: true, stock: true },
  });
  console.log("Products found:", JSON.stringify(products, null, 2));
  return products;
}

(async () => {
  try {
    const { email, password } = await ensureUser();
    await checkProducts([
      "cmr6ekxth000192p2r29uvvfv",
      "cmr56z1sw00014wwl0f81y1zz",
    ]);

    const apiUrl = "http://localhost:3000";
    const signIn = await axios.post(`${apiUrl}/auth/signin`, {
      email,
      password,
    });
    const token = signIn.data.accessToken;
    console.log("Signed in debug user, token length:", token.length);

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
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("ORDER RESPONSE STATUS:", orderResponse.status);
    console.log(
      "ORDER RESPONSE DATA:",
      JSON.stringify(orderResponse.data, null, 2),
    );
  } catch (err) {
    if (err.response) {
      console.error("HTTP ERROR STATUS:", err.response.status);
      console.error(
        "HTTP ERROR DATA:",
        JSON.stringify(err.response.data, null, 2),
      );
      console.error(
        "HTTP ERROR HEADERS:",
        JSON.stringify(err.response.headers, null, 2),
      );
    } else {
      console.error("ERROR:", err.message);
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
