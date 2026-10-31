import type { JsonObject, Subscription } from "../src/index";

type Accepts<Target, Value> = [Value] extends [Target] ? true : false;
type Not<Flag extends boolean> = Flag extends true ? false : true;

type Proof<Flag extends true> = Flag;

interface InterfaceTyped {
  name: string;
}

export type Proofs = [
  Proof<Accepts<JsonObject, { status?: string }>>,
  Proof<Accepts<JsonObject, { nextPaymentDate: string | undefined }>>,
  Proof<Accepts<JsonObject, { tags: string[]; nested: { count: number } }>>,
  Proof<Accepts<NonNullable<Subscription["vendorData"]>, { phase: null }>>,
  Proof<Not<Accepts<JsonObject, { sentAt: Date }>>>,
  Proof<Not<Accepts<JsonObject, { attachment: Buffer }>>>,
  Proof<Not<Accepts<JsonObject, { render: () => string }>>>,
  Proof<Not<Accepts<JsonObject, { tags: readonly string[] }>>>,
  Proof<Not<Accepts<JsonObject, InterfaceTyped>>>,
  Proof<Not<Accepts<Subscription["vendorData"], { sentAt: Date }>>>,
];
