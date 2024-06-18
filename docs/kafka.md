#### KAFKA Topics

| Topic   | Data                                                   | Events                                                   |
| ------- | ------------------------------------------------------ | -------------------------------------------------------- |
| product | `{ "event_type": "PRODUCT_CREATE", "data": "data..."}` | PRODUCT_CREATE, PRODUCT_UPDATE, PRODUCT_DELETE           |
| topping | `{ "event_type": "TOPPING_CREATE", "data": "data..."}` | TOPPING_CREATE, TOPPING_UPDATE, TOPPING_DELETE           |
| order   | `{ "event_type": "ORDER_CREATE", "data": "data..."}`   | ORDER_CREATE, PAYMENT_STATUS_UPDATE, ORDER_STATUS_UPDATE |
