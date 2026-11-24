import type { Place as LivePlace } from "../services/places";
import React, { createContext, useContext, useState } from "react";

export const facilityNames = [
  "منحدرات",
  "مصاعد",
  "دورات مياه مهيأة",
  "مواقف مخصصة",
  "مداخل مهيأة",
  "مسارات ملموسة",
  "لوحات برايل",
  "تنبيهات مرئية",
  "أنظمة سمعية",
];
export type Availability =
  | "available"
  | "unavailable"
  | "not_applicable"
  | "unknown";
export const statusNames: Record<Availability, string> = {
  available: "متاح",
  unavailable: "غير متاح",
  not_applicable: "غير منطبق",
  unknown: "غير مسجل",
};
export type Place = {
  id: number;
  name: string;
  category: string;
  address: string;
  lat: number;
  lon: number;
  facilities: Availability[];
  photo?: boolean;
};
export type Review = {
  id: number;
  placeId: number;
  live?: boolean;
  placeName?: string;
  author: string;
  name: string;
  score: number;
  text: string;
  photos: string[];
};
export type Report = {
  id: number;
  placeId: number;
  live?: boolean;
  placeName?: string;
  kind: string;
  text: string;
  status: string;
};
export type Account = { email: string; name: string; suspended: boolean };
export const memberEmail = "gamar@example.com",
  adminEmail = "admin@aoun.example";
const yes: Availability = "available",
  no: Availability = "unavailable",
  na: Availability = "not_applicable";
const seed: Place[] = [
  {
    id: 1,
    name: "مكتبة الملك فهد الوطنية",
    category: "مرافق عامة",
    address: "طريق الملك فهد، حي العليا، الرياض",
    lat: 24.687,
    lon: 46.685,
    facilities: [yes, yes, yes, yes, yes, yes, no, yes, na],
    photo: true,
  },
  {
    id: 2,
    name: "مقهى تجريبي",
    category: "مقاهي",
    address: "حي الياسمين، الرياض",
    lat: 24.825,
    lon: 46.66,
    facilities: [yes, na, yes, no, yes, yes, yes, yes, no],
  },
  {
    id: 3,
    name: "الرياض بارك",
    category: "مرافق عامة",
    address: "حي العقيق، الرياض",
    lat: 24.756,
    lon: 46.63,
    facilities: [yes, yes, yes, yes, yes, yes, yes, no, no],
  },
];
export function level(place: Place) {
  const items = place.facilities.filter((x) => x !== "not_applicable");
  if (items.length === 0 || items.includes("unknown"))
    return "بانتظار المراجعة";
  const ratio = items.filter((x) => x === "available").length / items.length;
  return ratio >= 0.7 ? "مهيأ بالكامل" : ratio > 0 ? "مهيأ جزئيًا" : "غير مهيأ";
}
export function distance(lat: number, lon: number, p: Place) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(p.lat - lat) / 2) ** 2 +
    Math.cos(rad(lat)) *
      Math.cos(rad(p.lat)) *
      Math.sin(rad(p.lon - lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function useDemoState() {
  const passwords = React.useRef<Record<string, string>>({
    [memberEmail]: "AounDemo1",
    [adminEmail]: "AounDemo1",
  });
  const [email, setEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([
    { email: memberEmail, name: "قمر", suspended: false },
  ]);
  const [places, setPlaces] = useState(seed);
  const [reviews, setReviews] = useState<Review[]>([
    {
      id: 1,
      placeId: 2,
      author: memberEmail,
      name: "قمر",
      score: 4,
      text: "المدخل واسع والمنحدر سهّل الدخول.",
      photos: [],
    },
    {
      id: 2,
      placeId: 1,
      author: "sara@example.com",
      name: "سارة",
      score: 5,
      text: "المنحدر واضح والمداخل مهيأة.",
      photos: [],
    },
  ]);
  const [liveFavoritesByEmail, setLiveFavorites] = useState<
    Record<string, LivePlace[]>
  >({});
  const liveFavorites = email ? (liveFavoritesByEmail[email] ?? []) : [];
  function toggleLiveFavorite(place: LivePlace) {
    if (!user || user.suspended) return;
    setLiveFavorites((previous) => {
      const saved = previous[user.email] ?? [];
      const next = saved.some((item) => item.id === place.id)
        ? saved.filter((item) => item.id !== place.id)
        : [...saved, place];
      return { ...previous, [user.email]: next };
    });
  }
  const [favorites, setFavorites] = useState<Record<string, number[]>>({
    [memberEmail]: [2],
  });
  const [reports, setReports] = useState<Report[]>([
    {
      id: 1,
      placeId: 2,
      kind: "معلومة خاطئة",
      text: "معلومة المواقف المخصصة تحتاج إلى تحديث.",
      status: "تم الإرسال",
    },
  ]);
  const [origin, setOrigin] = useState({
    lat: 24.7136,
    lon: 46.6753,
    label: "وسط الرياض",
  });
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const user = accounts.find((u) => u.email === email);
  const admin = email === adminEmail;
  function toggleFavorite(id: number) {
    if (!email || !user || user.suspended) return;
    setFavorites((old) => {
      const list = old[email] ?? [];
      return {
        ...old,
        [email]: list.includes(id)
          ? list.filter((i) => i !== id)
          : [...list, id],
      };
    });
  }
  function removePlace(id: number) {
    setPlaces((v) => v.filter((x) => x.id !== id));
    setReviews((v) => v.filter((x) => x.live || x.placeId !== id));
    setReports((v) => v.filter((x) => x.live || x.placeId !== id));
    setFavorites((v) =>
      Object.fromEntries(
        Object.entries(v).map(([k, ids]) => [k, ids.filter((i) => i !== id)]),
      ),
    );
  }
  return {
    passwords,
    email,
    setEmail,
    user,
    admin,
    accounts,
    setAccounts,
    places,
    setPlaces,
    reviews,
    setReviews,
    favorites,
    toggleFavorite,
    liveFavorites,
    toggleLiveFavorite,
    reports,
    setReports,
    removePlace,
    origin,
    setOrigin,
    lang,
    setLang,
  };
}
const Context = createContext<ReturnType<typeof useDemoState> | null>(null);
export function DemoProvider({ children }: React.PropsWithChildren) {
  const state = useDemoState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useDemo() {
  const state = useContext(Context);
  if (!state) throw Error("DemoProvider missing");
  return state;
}
