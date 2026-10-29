import type { JsonObject, Subscription } from "../src/index";

type Accepts<Target, Value> = [Value] extends [Target] ? true : false;
type Not<Flag extends boolean> = Flag extends true ? false : true;

interface InterfaceTyped {
  name: string;
}

declare function assertType<Flag extends true>(): Flag;

assertType<Accepts<JsonObject, { status?: string }>>();
assertType<Accepts<JsonObject, { nextPaymentDate: string | undefined }>>();
assertType<
  Accepts<JsonObject, { tags: string[]; nested: { count: number } }>
>();
assertType<Accepts<NonNullable<Subscription["vendorData"]>, { phase: null }>>();
assertType<Not<Accepts<JsonObject, { sentAt: Date }>>>();
assertType<Not<Accepts<JsonObject, { attachment: Buffer }>>>();
assertType<Not<Accepts<JsonObject, { render: () => string }>>>();
assertType<Not<Accepts<JsonObject, { tags: readonly string[] }>>>();
assertType<Not<Accepts<JsonObject, InterfaceTyped>>>();
assertType<Not<Accepts<Subscription["vendorData"], { sentAt: Date }>>>();
