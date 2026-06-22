// Estado compartido del mini-cart drawer (abrir/cerrar desde cualquier componente).
export const useCartUI = () => {
  const open = useState('cartDrawerOpen', () => false)
  return {
    open,
    openCart: () => { open.value = true },
    closeCart: () => { open.value = false },
  }
}
