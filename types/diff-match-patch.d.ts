declare module 'diff-match-patch' {
  // Minimal typings for our usage. The upstream package ships JS only.
  // If we ever need richer typing, we can expand this or swap to a typed lib.
  export class diff_match_patch {
    patch_make(text1: string, text2: string): any[];
    patch_toText(patches: any[]): string;
    patch_apply(patches: any[], text: string): [string, boolean[]];
  }
}

