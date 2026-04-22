# In-Deal SRS Phase 1

## Overview

This document outlines the Phase 1 scope for the In-Deal system, including authentication, localization, company portfolio features, deals, customer support, and chat.

---

## 1. Login and Registration (AUTH)

| Use Case         | Main Actor            | Description                                                                                                                                                                                                                                                | Priority  | Stability |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| Login            | Companies admins      | Users enter email and password. The system validates required fields, checks email format, validates credentials, and shows error messages when needed.                                                                                                    | Mandatory | Stable    |
| Company Register | Company administrator | The administrator enters agent name, agent job title, company name, company type, company industry, company website, manufacturing strategy, address, email, phone, uploads files, sets a password, and creates the account successfully.                  | Mandatory | Stable    |
| Forget Password  | Company administrator | The system sends validation to the user, the user validates their account, the system checks the user, shows errors if needed, accepts reset password input, confirms password, checks password strength and password match, then returns to login screen. | Mandatory | Stable    |

---

## 2. Company Portfolio

| Use Case                | Main Actor       | Description                                                                                                                                                                                                                                     | Priority  | Stability |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| Resend for review       | Companies admins | Edit company documents and details, then resend them for review.                                                                                                                                                                                | Mandatory | Stable    |
| Profile page (settings) | Companies admins | The system shows ID, name, email, image, agent ID, and agent name. Users can edit password, image, and agent name, and change language and theme.                                                                                               | Mandatory | Stable    |
| Company summary         | Companies admins | Admins can add a company summary that represents the company’s business description and achievements.                                                                                                                                           | Mandatory | Stable    |
| Company gallery         | Companies admins | Show and edit images and certificates.                                                                                                                                                                                                          | Mandatory | Stable    |
| Company certificate     | Companies admins | Certificate includes a file, which may be an image, plus certificate title, issuer date, and URL.                                                                                                                                               | —         | —         |
| Show company details    | System           | The system shows company name, type, industry, manufacture strategy, image, website, locations, description, gallery, contact info, and contributions.                                                                                          | Mandatory | Stable    |
| Edit details            | Companies admins | Edit manufacture strategy, website, locations, description, company gallery, contact info, and each contribution.                                                                                                                               | Mandatory | Stable    |
| Contact info            | Companies admins | Admins can add company contact info including email, phone number, social media links, and company location.                                                                                                                                    | Mandatory | Stable    |
| Contributions           | Companies admins | Display company contributions by field. Each contribution includes media, title, description, and type. Contribution examples include popular and successful products, effective projects, major deals and contracts, and biggest partnerships. | Mandatory | Stable    |
| Contributions media     | System           | Includes image, video, and files.                                                                                                                                                                                                               | Mandatory | Stable    |
| Project                 | System           | Includes main data and mentions of other contributors.                                                                                                                                                                                          | Mandatory | Stable    |
| Product                 | System           | Includes main data only.                                                                                                                                                                                                                        | Mandatory | Stable    |
| Partnership             | System           | Includes partner name, logo, and mention.                                                                                                                                                                                                       | Mandatory | Stable    |

---

## 3. Deals

| Use Case                  | Main Actor       | Description                                                                                                                                                                                                                                                                                        | Priority  | Stability |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| Create deal               | Companies admins | Company admin creates a new deal. Each deal includes title, description, images, files, price, and type (supply or demand).                                                                                                                                                                        | Mandatory | Stable    |
| Manage my deals           | Companies admins | Delete a deal, update a deal, close a deal so nobody can apply, and reopen a deal so people can apply again.                                                                                                                                                                                       | Mandatory | Stable    |
| Max deals limits          | Companies admins | Each company has a maximum number of open deals.                                                                                                                                                                                                                                                   | Mandatory | Stable    |
| Search a deal             | Companies admins | Search deals using keywords, industry, price, date/time, and type. Results can be sorted by price, date/time, and number of applications in ascending or descending order.                                                                                                                         | Mandatory | Stable    |
| Apply offer for in supply | Companies admins | Companies can apply to other deals using a structured request form that includes request info, commercial requirements, supply type, technical specifications, logistics and timing, plus notes and attachments. Required fields are red, optional fields are black, and dropdown fields are bold. | Mandatory | Stable    |
| Apply offer for in demand | Companies admins | Companies can submit an offer including offer summary, pricing, availability, lead time, specification confirmation, commercial terms, and notes/attachments. Required fields are red, optional fields are black, and dropdown fields are bold.                                                    | Mandatory | Stable    |
| Apply history             | Companies admins | Companies can see applied requests, and admins can pause or cancel an application request with a cancel reason.                                                                                                                                                                                    | Mandatory | Stable    |
| Request for quotation     | Companies admins | Companies send a deal request using the same data structure as the supply offer.                                                                                                                                                                                                                   | Mandatory | Stable    |
| My requests               | Companies admins | Companies can view their requests and the requests they have sent.                                                                                                                                                                                                                                 | Mandatory | Stable    |

### 4.1 Apply Offer for In Supply — Detailed Fields

#### 1. Basic request info

- Product/service name
- Category:
  - Packing and containers
  - Raw material
  - Industrial equipment
  - Food and beverage
  - Chemicals
  - Textile and apparel
  - Electronics and components
  - Construction materials and services

- Quantity required
- Delivery location
- Delivery date

#### 2. Commercial requirements

- Target price range
- Currency
- Payment terms preference
- Incoterms:
  - EXW
  - CIF
  - FOB
  - DAP
  - DDP

- Bulk discount expectation

#### 3. Supply type

- In stock
- Make to order
- Either

#### 4. Technical specifications

- Key specifications
- Material
- Dimensions / size
- Certifications required
- Quality level:
  - Standard
  - Industrial guide
  - Food grade
  - Pharmaceutical grade
  - Export quality

- Color / finish
- Country of origin

#### 5. Logistics and timing

- Max lead time accepted
- Delivery method preference:
  - Supplier delivers
  - Buyer collects
  - Third party

- Packaging requirements

#### 6. Additional notes and attachments

- Special conditions / notes
- Attachments

### 4.2 Apply Offer for In Demand — Detailed Fields

#### 1. Offer summary

- Product / service name
- Available quantity
- Offer validity days

#### 2. Pricing

- Unit price
- Currency
- Total price
- Volume discount tiers as a list of strings
- MOQ (minimum order quantity)

#### 3. Availability

- Availability type:
  - In stock
  - Make to order
  - Mixed

- Quantity in stock
- Max produce quantity

#### 4. Lead time

- Stock delivery time
- Production lead time

#### 5. Specification confirmation

- Specs match RFQ:
  - Yes
  - No
  - Partial

- Differences / deviations from RFQ
- Material offered
- Dimensions
- Certifications held

#### 6. Commercial terms

- Payment terms
- Delivery terms:
  - EXW
  - CIF
  - FOB
  - DAP
  - DDP

- Warranty / return policy
- Exclusivity / confidentiality

#### 7. Notes and attachments

- Additional notes
- Attachments

---

## 4. Chats

| Use Case  | Main Actor | Description                                                                                         | Priority  | Stability |
| --------- | ---------- | --------------------------------------------------------------------------------------------------- | --------- | --------- |
| Live chat | All users  | Users can send messages in real time. The source appears truncated, so this item may be incomplete. | Mandatory | Stable    |
