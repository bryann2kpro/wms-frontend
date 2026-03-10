import { createStore, createAtom } from "@tanstack/store";

export const store = createStore({
	firstName: "Jane",
	lastName: "Smith",
});

export const fullName = createAtom(
	() => `${store.get().firstName} ${store.get().lastName}`,
);
