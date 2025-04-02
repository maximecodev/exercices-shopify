class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      const result = this.onCartUpdate();
      result.then(() => {
        this.checkDeliveryThreshold();
        this.checkGiftThreshold();
      });
    });

    if (this.tagName === 'CART-DRAWER-ITEMS') {
      this.checkDeliveryThreshold();
      this.checkGiftThreshold();
    }
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  /**
   * Configuration globale pour la gestion du produit cadeau
   * @type {Object}
   */
  giftConfig = {
    VARIANT_ID: '54480217440581',
    THRESHOLD: 100,
  };

  /**
   * Vérifie si le panier atteint un seuil spécifique et affiche un message approprié
   * @param {Object} options - Options de configuration
   * @param {string} options.type - Type de seuil ('delivery' ou 'gift')
   * @param {number} options.threshold - Montant du seuil en euros
   * @param {string} options.messageSelector - Sélecteur CSS pour le conteneur du message
   * @param {Function} options.messageFormatter - Fonction qui formate le message à afficher
   */
  async checkThreshold(options) {
    const { type, threshold, messageSelector, messageFormatter } = options;

    // Récupérer le total du panier via l'API de Shopify
    return fetch(`${routes.cart_url}.js`)
      .then((response) => response.json())
      .then((cart) => {
        const cartTotal = cart.total_price / 100; // Convertir de centimes à euros

        if (cartTotal < threshold) {
          const messageContainer = document.querySelector(messageSelector);
          if (messageContainer) {
            messageContainer.classList.remove('hidden');
            const remaining = (threshold - cartTotal).toFixed(2);
            const message = messageFormatter(remaining);

            // Mettre à jour le contenu du message
            const contentElement =
              messageContainer.querySelector(`.${type}-message__content`) ||
              messageContainer.querySelector('.message-drawer__content');
            if (contentElement) {
              contentElement.textContent = message;
            }

            // S'assurer d'ajouter l'écouteur d'événement une seule fois
            const button =
              messageContainer.querySelector(`.${type}-message__button`) ||
              messageContainer.querySelector('.message-drawer__button');
            if (button) {
              button.removeEventListener('click', this.hideMessage);
              button.addEventListener('click', () => this.hideMessage(messageSelector));
            }
          }
        } else {
          // Cacher le message si le seuil est atteint
          const messageContainer = document.querySelector(messageSelector);
          if (messageContainer) {
            messageContainer.classList.add('hidden');
          }
        }

        return cartTotal; // Retourner le total pour une utilisation ultérieure si nécessaire
      })
      .catch((e) => {
        console.error(`Erreur lors de la vérification du seuil de ${type}:`, e);
        return 0;
      });
  }

  /**
   * Cache un conteneur de message
   * @param {string} selector - Sélecteur CSS du conteneur à cacher
   */
  hideMessage(selector) {
    const messageContainer = document.querySelector(selector);
    if (messageContainer) {
      messageContainer.classList.add('hidden');
    }
  }

  /**
   * Vérifie le seuil pour la livraison gratuite
   */
  checkDeliveryThreshold() {
    return this.checkThreshold({
      type: 'delivery',
      threshold: 50,
      messageSelector: '.delivery-drawer',
      messageFormatter: (remaining) => `Plus que ${remaining}€ pour bénéficier de la livraison gratuite`,
    });
  }

  /**
   * Vérifie le seuil pour le cadeau offert
   */
  async checkGiftThreshold() {
    return this.checkThreshold({
      type: 'gift',
      threshold: this.giftConfig.THRESHOLD,
      messageSelector: '.gift-drawer',
      messageFormatter: (remaining) => `Plus que ${remaining}€ pour recevoir un cadeau offert`,
    }).then((cartTotal) => this.handleGiftBasedOnTotal(cartTotal));
  }

  /**
   * Gère l'ajout ou la suppression du cadeau en fonction du total
   * @param {number} cartTotal - Le montant total du panier
   */
  async handleGiftBasedOnTotal(cartTotal) {
    try {
      if (cartTotal >= this.giftConfig.THRESHOLD) {
        await this.handleGiftProduct();
      } else {
        await this.removeGiftProduct();
      }
    } catch (error) {
      console.error('Erreur lors de la gestion du cadeau:', error);
    }
  }

  /**
   * Vérifie si le produit cadeau est dans le panier
   */
  async isGiftInCart() {
    const cartData = await this.getCartContent();
    return cartData.items.some(
      (item) => item.variant_id.toString() === this.giftConfig.VARIANT_ID && item.properties?._gift === true
    );
  }

  /**
   * Ajoute le produit cadeau si nécessaire
   */
  async handleGiftProduct() {
    try {
      if (await this.isGiftInCart()) return;

      const formData = {
        items: [
          {
            id: this.giftConfig.VARIANT_ID,
            quantity: 1,
            properties: { _gift: true },
          },
        ],
      };

      const response = await fetch(`${routes.cart_url}/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Afficher le message
        const messageContainer = document.querySelector('.notification');
        if (messageContainer) {
          messageContainer.classList.add('active');
          const contentElement = messageContainer.querySelector('.notification__content');
          if (contentElement) {
            contentElement.textContent = 'Votre cadeau a été ajouté au panier !';
          }
        }

        // Mettre à jour le panier sans recharger tout le drawer
        const cartData = await response.json();
        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'gift-auto-add',
          cartData: cartData,
        });

        // Supprimer le message après 3 secondes
        setTimeout(() => {
          if (messageContainer) {
            messageContainer.classList.remove('active');
          }
        }, 6000);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du cadeau:", error);
    }
  }

  /**
   * Trouve et supprime le produit cadeau si présent
   */
  async removeGiftProduct() {
    try {
      const cartData = await this.getCartContent();
      const giftItem = cartData.items.find(
        (item) => item.variant_id.toString() === this.giftConfig.VARIANT_ID && item.properties?._gift === true
      );

      if (giftItem) {
        const index = cartData.items.indexOf(giftItem) + 1;
        this.updateQuantity(index, 0, new Event('click'));
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du cadeau:', error);
    }
  }

  /**
   * Récupère le contenu du panier
   */
  async getCartContent() {
    const response = await fetch(`${routes.cart_url}.js`);
    return response.json();
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) ||
              document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });

        this.checkDeliveryThreshold();
        this.checkGiftThreshold();
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } }).then(() =>
              CartPerformance.measureFromEvent('note-update:user-action', event)
            );
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
