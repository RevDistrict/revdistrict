export const site = {
  name: "RevDistrict",
  phone: "(801) 906-8111",
  phoneHref: "tel:+18019068111",
  smsHref: "sms:+18019068111",
  email: "utahusedcarfactory@gmail.com",
  // Provider-supplied iframe; set CREDIT_APPLICATION_URL to switch from staging to production.
  creditApplicationUrl:
    process.env.CREDIT_APPLICATION_URL || "https://staging.dealr.website/39984",
  address: "7036 S High Tech Dr",
  city: "Midvale, UT 84047",
  maps: "https://www.google.com/maps/search/?api=1&query=7036+S+High+Tech+Dr+Midvale+UT+84047",
  instagram: "https://www.instagram.com/theusedcarfactoryut/",
  youtube: "https://www.youtube.com/@mcgoo_is_manic",
};
export const navigation = [
  { href: "/inventory", label: "Inventory" },
  { href: "/financing", label: "Financing" },
  { href: "/consignment", label: "Consignment" },
  { href: "/sell-your-vehicle", label: "Sell / Trade" },
  { href: "/our-story", label: "The District" },
];
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
