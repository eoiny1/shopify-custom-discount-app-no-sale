// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * Determines if a cart line represents a sale item
 * @param {any} cartLine The cart line to check
 * @returns {boolean} True if the cart line is a sale item, false otherwise
 */
function isSaleItem(cartLine) {
  // First, ensure we have the necessary properties
  if (!cartLine?.cost?.amountPerQuantity?.amount) {
    return false;
  }
  
  // Check if this is a ProductVariant and has a sale tag on its product
  if (cartLine.merchandise?.__typename === "ProductVariant" && 
      cartLine.merchandise?.product?.hasAnyTag === true) {
    return true;
  }
  
  // Check if compareAtAmountPerQuantity exists and is higher than the current price
  if (cartLine.cost.compareAtAmountPerQuantity?.amount && 
      parseFloat(cartLine.cost.compareAtAmountPerQuantity.amount) > 
      parseFloat(cartLine.cost.amountPerQuantity.amount)) {
    return true;
  }
  
  return false;
}

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  // Parse configuration from metafield
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? '{"percentageDiscount": 25, "maximumDiscountAmount": 500}'
  );

  const percentageDiscount = configuration.percentageDiscount || 25;
  const maximumDiscountAmount = configuration.maximumDiscountAmount || 500;
  
  // Get cart and customer information
  const cart = input?.cart;
  if (!cart) {
    return EMPTY_DISCOUNT;
  }
  
  const buyerIdentity = cart?.buyerIdentity;
  const customer = buyerIdentity?.customer;
  
  // Check if customer has already used this discount
  if (customer && customer.metafield && customer.metafield.value === "true") {
    // Customer has already used this discount
    return EMPTY_DISCOUNT;
  }
  
  // For anonymous customers or first-time discount users, we'll continue
  
  // Find non-sale items in the cart
  const nonSaleItems = cart.lines?.filter(line => !isSaleItem(line)) || [];
  
  // If no non-sale items, return empty discount
  if (nonSaleItems.length === 0) {
    return EMPTY_DISCOUNT;
  }
  
  /** @type {Array<any>} */
  const targets = [];
  
  // Create a target for each non-sale item
  for (const line of nonSaleItems) {
    // Check if this is a ProductVariant (not a CustomProduct)
    if (line.merchandise.__typename === "ProductVariant" && line.merchandise.id) {
      // Target structure according to the GraphQL schema
      const target = {
        productVariant: {
          id: line.merchandise.id,
          quantity: line.quantity
        }
      };
      
      targets.push(target);
    }
  }
  
  // Calculate potential discount amount to check against cap
  let potentialDiscountAmount = 0;
  for (const line of nonSaleItems) {
    const lineTotal = parseFloat(line.cost.subtotalAmount.amount);
    potentialDiscountAmount += lineTotal * (percentageDiscount / 100);
  }
  
  // If potential discount exceeds cap, adjust percentage to respect the cap
  let effectivePercentage = percentageDiscount;
  let discountMessage = `${percentageDiscount}% off non-sale items`;
  
  if (potentialDiscountAmount > maximumDiscountAmount) {
    // Calculate a reduced percentage that would result in exactly the maximum discount
    const nonSaleItemsTotal = nonSaleItems.reduce((sum, line) => 
      sum + parseFloat(line.cost.subtotalAmount.amount), 0);
    
    effectivePercentage = (maximumDiscountAmount / nonSaleItemsTotal) * 100;
    discountMessage = `${Math.floor(effectivePercentage)}% off non-sale items (capped at ${maximumDiscountAmount})`;
  }
  
  // Create the discount
  const discount = {
    targets,
    value: {
      percentage: {
        value: effectivePercentage.toString()
      }
    },
    message: discountMessage,
    conditions: []
  };
  
  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [discount]
  };
};