const order = {
  id: "cmrtwacum000j9rrs89e6icdo",
  items: [
    {
      id: "cmrtwacun000l9rrsnldffq4c",
      orderId: "cmrtwacum000j9rrs89e6icdo",
      productId: "cmredvs5p000cm5yievtgq9kv",
      quantity: 1,
      price: 25000,
      name: "Sneakers Pack",
      affiliateCode: "AFF-1784592355922-KVFF3I-sneakers-pack",
      sellerId: "cmredrdde000am5yisrqaysde",
    },
    {
      id: "cmrtwacun000m9rrs7n3zla5t",
      orderId: "cmrtwacum000j9rrs89e6icdo",
      productId: "cmredvs5p000cm5yievtgq9kv",
      quantity: 1,
      price: 25000,
      name: "Sneakers Pack",
      affiliateCode: "AFF-1784592314318-PLPFTN-sneakers-pack",
      sellerId: "cmredrdde000am5yisrqaysde",
    },
    {
      id: "cmrtwacun000n9rrs0k8f97xl",
      orderId: "cmrtwacum000j9rrs89e6icdo",
      productId: "cmre8tdhs0007121sbohmymiu",
      quantity: 1,
      price: 3000,
      name: "Dan",
      affiliateCode: "AFF-1784592314318-PLPFTN-sneakers-pack",
      sellerId: "cmre8sewd0005121srollgohy",
    },
  ],
};
const affiliateLinks = [
  {
    id: "cmrtw8xjs000d9rrs8pfxx4jd",
    code: "AFF-1784592314318-PLPFTN-sneakers-pack",
    productId: "cmredvs5p000cm5yievtgq9kv",
    product: { id: "cmredvs5p000cm5yievtgq9kv" },
  },
];
const affiliateLinkByCode = new Map(
  affiliateLinks.map((link) => [link.code, link]),
);
const affiliateLinkByProductId = new Map(
  affiliateLinks.map((link) => [link.productId || link.product?.id, link]),
);
const getLinkForItem = (item) => {
  if (!item) return undefined;
  if (item.affiliateCode) {
    return affiliateLinkByCode.get(item.affiliateCode);
  }
  if (item.productId) {
    return affiliateLinkByProductId.get(item.productId);
  }
  return undefined;
};
const directMatches = order.items
  .map((item) => {
    const link = getLinkForItem(item);
    return link ? { item, link } : undefined;
  })
  .filter(Boolean);
console.log("directMatches", directMatches);
