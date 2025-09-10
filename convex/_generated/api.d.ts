/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as generate from "../generate.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_validators from "../lib/validators.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  generate: typeof generate;
  http: typeof http;
  images: typeof images;
  "lib/auth": typeof lib_auth;
  "lib/images": typeof lib_images;
  "lib/validators": typeof lib_validators;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
