import { describe, it, expect } from 'vitest';
import { run } from './index';

/**
 * @typedef {import("../generated/api").FunctionResult} FunctionResult
 */

describe('order discounts function', () => {
  it('returns no discounts with empty cart', () => {
    const result = run({
      discountNode: {
        metafield: null
      },
      cart: {
        lines: []
      }
    });
    const expected = /** @type {FunctionResult} */ ({
      discounts: [],
      discountApplicationStrategy: "FIRST",
    });

    expect(result).toEqual(expected);
  });
  
  it('handles null cart gracefully', () => {
    const result = run({
      discountNode: {
        metafield: null
      },
      cart: null
    });
    
    expect(result.discounts.length).toBe(0);
  });
  
  it('applies 25% discount to non-sale items only', () => {
    // Mock cart with both sale and non-sale items
    const mockCart = {
      lines: [
        // Non-sale item
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 2,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/1',
            product: {
              id: 'gid://shopify/Product/1',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '10.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '20.00',
              currencyCode: 'USD'
            }
          }
        },
        // Sale item (has compare at price)
        {
          id: 'gid://shopify/CartLine/2',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/2',
            product: {
              id: 'gid://shopify/Product/2',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '15.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: {
              amount: '20.00',
              currencyCode: 'USD'
            },
            subtotalAmount: {
              amount: '15.00',
              currencyCode: 'USD'
            }
          }
        }
      ],
      buyerIdentity: {
        customer: {
          id: 'gid://shopify/Customer/1',
          email: 'test@example.com',
          metafield: null
        }
      },
      cost: {
        subtotalAmount: {
          amount: '35.00',
          currencyCode: 'USD'
        }
      }
    };
    
    const result = run({
      discountNode: {
        metafield: {
          value: JSON.stringify({
            percentageDiscount: 25,
            maximumDiscountAmount: 500
          })
        }
      },
      cart: mockCart
    });
    
    // We expect a discount only for the non-sale item
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0].targets.length).toBe(1);
    expect(result.discounts[0].targets[0].productVariant.id).toBe('gid://shopify/ProductVariant/1');
    expect(result.discounts[0].value.percentage.value).toBe('25');
  });
  
  it('identifies sale items by product tag', () => {
    const mockCart = {
      lines: [
        // Item with sale tag
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/1',
            product: {
              id: 'gid://shopify/Product/1',
              hasAnyTag: true  // Has a sale tag
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '10.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '10.00',
              currencyCode: 'USD'
            }
          }
        },
        // Regular item (no sale tag)
        {
          id: 'gid://shopify/CartLine/2',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/2',
            product: {
              id: 'gid://shopify/Product/2',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '15.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '15.00',
              currencyCode: 'USD'
            }
          }
        }
      ],
      buyerIdentity: {
        customer: null
      },
      cost: {
        subtotalAmount: {
          amount: '25.00',
          currencyCode: 'USD'
        }
      }
    };
    
    const result = run({
      discountNode: {
        metafield: {
          value: JSON.stringify({
            percentageDiscount: 25,
            maximumDiscountAmount: 500
          })
        }
      },
      cart: mockCart
    });
    
    // Only the non-sale item should get the discount
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0].targets.length).toBe(1);
    expect(result.discounts[0].targets[0].productVariant.id).toBe('gid://shopify/ProductVariant/2');
  });
  
  it('handles custom products correctly', () => {
    const mockCart = {
      lines: [
        // Custom product (not eligible for discount)
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          merchandise: {
            __typename: 'CustomProduct',
            // Note: no ID here
          },
          cost: {
            amountPerQuantity: {
              amount: '10.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '10.00',
              currencyCode: 'USD'
            }
          }
        },
        // Regular product variant
        {
          id: 'gid://shopify/CartLine/2',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/2',
            product: {
              id: 'gid://shopify/Product/2',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '15.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '15.00',
              currencyCode: 'USD'
            }
          }
        }
      ],
      buyerIdentity: null,
      cost: {
        subtotalAmount: {
          amount: '25.00',
          currencyCode: 'USD'
        }
      }
    };
    
    const result = run({
      discountNode: {
        metafield: {
          value: JSON.stringify({
            percentageDiscount: 25,
            maximumDiscountAmount: 500
          })
        }
      },
      cart: mockCart
    });
    
    // Only the regular product variant should get the discount
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0].targets.length).toBe(1);
    expect(result.discounts[0].targets[0].productVariant.id).toBe('gid://shopify/ProductVariant/2');
  });
  
  it('caps discount at $500', () => {
    // Create a high-value cart that would exceed the cap
    const mockCart = {
      lines: [
        // Non-sale high-value item (would generate >$500 discount at 25%)
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/1',
            product: {
              id: 'gid://shopify/Product/1',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '2500.00',  // 25% of this would be $625
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '2500.00',
              currencyCode: 'USD'
            }
          }
        }
      ],
      buyerIdentity: null,
      cost: {
        subtotalAmount: {
          amount: '2500.00',
          currencyCode: 'USD'
        }
      }
    };
    
    const result = run({
      discountNode: {
        metafield: {
          value: JSON.stringify({
            percentageDiscount: 25,
            maximumDiscountAmount: 500
          })
        }
      },
      cart: mockCart
    });
    
    // Expect a reduced percentage to cap at $500
    expect(result.discounts.length).toBe(1);
    const appliedPercentage = parseFloat(result.discounts[0].value.percentage.value);
    expect(appliedPercentage).toBeLessThan(25);
    // The percentage should be adjusted to create exactly a $500 discount
    expect(appliedPercentage).toBeCloseTo(20, 1); // 20% of $2500 is $500
  });
  
  it('does not apply discount to customers who already used it', () => {
    const mockCart = {
      lines: [
        // Non-sale item
        {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/1',
            product: {
              id: 'gid://shopify/Product/1',
              hasAnyTag: false
            }
          },
          cost: {
            amountPerQuantity: {
              amount: '10.00',
              currencyCode: 'USD'
            },
            compareAtAmountPerQuantity: null,
            subtotalAmount: {
              amount: '10.00',
              currencyCode: 'USD'
            }
          }
        }
      ],
      buyerIdentity: {
        customer: {
          id: 'gid://shopify/Customer/1',
          email: 'test@example.com',
          metafield: {
            value: "true"  // Customer already used the discount
          }
        }
      },
      cost: {
        subtotalAmount: {
          amount: '10.00',
          currencyCode: 'USD'
        }
      }
    };
    
    const result = run({
      discountNode: {
        metafield: {
          value: JSON.stringify({
            percentageDiscount: 25,
            maximumDiscountAmount: 500
          })
        }
      },
      cart: mockCart
    });
    
    // No discount should be applied
    expect(result.discounts.length).toBe(0);
  });
});