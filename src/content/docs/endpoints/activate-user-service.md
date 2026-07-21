Activate a service for one of your users (agent / retailer / distributor) before
they can start transacting on it. The user is identified by their `user_code`
and the service by its `service_code`, both parameters passed in the URL path.

It is **mandatory** to activate a service for your users before they can use it
in production.

To find the `service_code` for any service, call the
[Get All Services](/docs/get-all-services) API. Some
of the common service codes are:

| Service | `service_code` |
|---|---|
| BBPS Bill Payments | 53 |
| Credit Card Bill Payment | 63 |
| AePS Fund Settlement | 39 |

After activation, confirm the status with the Get User's Services API.

> [!NOTE]
> Some services (like AePS Cash Withdrawal) require additional data or steps for
> activation. Their service-activation APIs are listed separately within those
> sections — for example [Activate AePS Fingpay](/docs/aeps-activate-fingpay).
