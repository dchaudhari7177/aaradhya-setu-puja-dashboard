import type { OfferingCategory } from "./types";

/**
 * A small, static puja catalog. In production this would live in the CMS /
 * Shopify catalog; the dashboard only needs a name, the temple it is performed
 * at, and the list price to pre-fill new bookings.
 */
export interface CatalogPuja {
  slug: string;
  name: string;
  category: OfferingCategory;
  deity: string;
  temple: { name: string; city: string };
  price: number;
  pandits: string[];
}

export const PUJA_CATALOG: CatalogPuja[] = [
  {
    slug: "rudrabhishek",
    name: "Rudrabhishek",
    category: "Puja",
    deity: "Lord Shiva",
    temple: { name: "Kashi Vishwanath Temple", city: "Varanasi" },
    price: 2100,
    pandits: ["Pt. Shivnarayan Tiwari", "Pt. Raghav Mishra"],
  },
  {
    slug: "maha-mrityunjaya-jaap",
    name: "Maha Mrityunjaya Jaap",
    category: "Puja",
    deity: "Lord Shiva",
    temple: { name: "Mahakaleshwar Jyotirlinga", city: "Ujjain" },
    price: 5100,
    pandits: ["Pt. Mahesh Sharma", "Pt. Anand Joshi"],
  },
  {
    slug: "kaal-sarp-dosh-nivaran",
    name: "Kaal Sarp Dosh Nivaran Puja",
    category: "Puja",
    deity: "Lord Shiva",
    temple: { name: "Trimbakeshwar Jyotirlinga", city: "Nashik" },
    price: 3100,
    pandits: ["Pt. Vinayak Kulkarni", "Pt. Sadashiv Deshpande"],
  },
  {
    slug: "satyanarayan-katha",
    name: "Satyanarayan Katha",
    category: "Puja",
    deity: "Lord Vishnu",
    temple: { name: "Shri Banke Bihari Temple", city: "Vrindavan" },
    price: 1501,
    pandits: ["Pt. Gopal Shastri", "Pt. Krishnakant Goswami"],
  },
  {
    slug: "navagraha-shanti",
    name: "Navagraha Shanti Puja",
    category: "Puja",
    deity: "Navagraha",
    temple: { name: "Suryanar Kovil", city: "Kumbakonam" },
    price: 2501,
    pandits: ["Pt. Venkatesh Iyer", "Pt. Subramanian Sastri"],
  },
  {
    slug: "lakshmi-kuber-puja",
    name: "Lakshmi Kuber Puja",
    category: "Puja",
    deity: "Goddess Lakshmi",
    temple: { name: "Mahalakshmi Temple", city: "Kolhapur" },
    price: 1851,
    pandits: ["Pt. Dattatray Joshi", "Pt. Prakash Kulkarni"],
  },
  {
    slug: "hanuman-chalisa-path",
    name: "Hanuman Chalisa Path (108 times)",
    category: "Puja",
    deity: "Lord Hanuman",
    temple: { name: "Sankat Mochan Hanuman Temple", city: "Varanasi" },
    price: 1100,
    pandits: ["Pt. Ramkumar Pandey", "Pt. Raghav Mishra"],
  },
  {
    slug: "ganga-aarti-chadhava",
    name: "Ganga Aarti Deep Daan",
    category: "Chadhava",
    deity: "Maa Ganga",
    temple: { name: "Dashashwamedh Ghat", city: "Varanasi" },
    price: 251,
    pandits: ["Pt. Shivnarayan Tiwari", "Pt. Ramkumar Pandey"],
  },
  {
    slug: "kashi-vishwanath-chadhava",
    name: "Bilva Patra & Jal Chadhava",
    category: "Chadhava",
    deity: "Lord Shiva",
    temple: { name: "Kashi Vishwanath Temple", city: "Varanasi" },
    price: 501,
    pandits: ["Pt. Raghav Mishra", "Pt. Shivnarayan Tiwari"],
  },
  {
    slug: "siddhivinayak-modak-chadhava",
    name: "Modak & Durva Chadhava",
    category: "Chadhava",
    deity: "Lord Ganesha",
    temple: { name: "Shree Siddhivinayak Temple", city: "Mumbai" },
    price: 351,
    pandits: ["Pt. Vinayak Kulkarni", "Pt. Dattatray Joshi"],
  },
];

export function findPuja(slug: string): CatalogPuja | undefined {
  return PUJA_CATALOG.find((p) => p.slug === slug);
}
