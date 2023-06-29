import {writable} from "svelte/store";

export const mainGPTSummary = writable("");

export const dataIsGood = writable(false);

export const loadingGPT = writable(false);
