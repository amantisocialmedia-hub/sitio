import { defineStore } from 'pinia'

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    slugs: [] as string[],
  }),
  getters: {
    count: (state) => state.slugs.length,
    has: (state) => (slug: string) => state.slugs.includes(slug),
  },
  actions: {
    toggle(slug: string) {
      if (this.slugs.includes(slug)) this.slugs = this.slugs.filter(s => s !== slug)
      else this.slugs.push(slug)
    },
    remove(slug: string) {
      this.slugs = this.slugs.filter(s => s !== slug)
    },
    clear() {
      this.slugs = []
    },
  },
  persist: true,
})
