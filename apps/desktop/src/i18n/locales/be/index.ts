// Aggregates the per-namespace catalogs of this language. One file per screen/area.
import type { LocaleCatalog } from "../../types";
import type { en } from "../en";
import { about } from "./about";
import { app } from "./app";
import { browse } from "./browse";
import { categories } from "./categories";
import { channel } from "./channel";
import { common } from "./common";
import { firstLaunch } from "./firstLaunch";
import { home } from "./home";
import { idea } from "./idea";
import { ideas } from "./ideas";
import { library } from "./library";
import { nav } from "./nav";
import { profile } from "./profile";
import { report } from "./report";
import { search } from "./search";
import { settings } from "./settings";
import { shell } from "./shell";
import { sources } from "./sources";
import { subscription } from "./subscription";
import { updates } from "./updates";

export const be: LocaleCatalog<typeof en> = {
  about,
  app,
  browse,
  categories,
  channel,
  common,
  firstLaunch,
  home,
  idea,
  ideas,
  library,
  nav,
  profile,
  report,
  search,
  settings,
  shell,
  sources,
  subscription,
  updates,
};
