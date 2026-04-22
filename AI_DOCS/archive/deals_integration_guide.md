# Deals Integration Guide

Complete guide for integrating inDeal Deals (Auctions & RFQs) into web and mobile apps.

---

## Overview

The deals system enables:

- **Publishing deals** (Auctions/RFQs) to find suppliers/partners
- **Browsing deals** with filters (type, industry, price range)
- **Submitting bids/requests** on deals
- **Managing deal lifecycle** (open → negotiating → closed)

---

## Authentication

All deal endpoints except search/view require a valid JWT token.

```javascript
headers: {
  'Authorization': 'Bearer <JWT_TOKEN>',
  'Content-Type': 'application/json'
}
```

---

## REST API Endpoints

Base URL: `https://api.indeal.com/api/v1`

### Public

| Method | Endpoint     | Description       |
| ------ | ------------ | ----------------- |
| GET    | `/deals`     | Search deals      |
| GET    | `/deals/:id` | View deal details |

### Authenticated

| Method | Endpoint                                    | Description          |
| ------ | ------------------------------------------- | -------------------- |
| POST   | `/deals`                                    | Create deal          |
| PUT    | `/deals/:id`                                | Update my deal       |
| DELETE | `/deals/:id`                                | Archive my deal      |
| GET    | `/deals/me/deals`                           | My published deals   |
| GET    | `/deals/me/requests`                        | My submitted bids    |
| POST   | `/deals/:id/requests`                       | Submit bid           |
| GET    | `/deals/:id/requests`                       | View bids on my deal |
| PATCH  | `/deals/:dealId/requests/:requestId/status` | Accept/reject bid    |
| DELETE | `/deals/requests/:requestId`                | Withdraw my bid      |

---

## Searching Deals

```javascript
// Fetch deals with filters
const params = new URLSearchParams({
  keyword: 'steel',
  dealType: 'rfq', // 'auction' | 'rfq'
  status: 'open', // 'open' | 'closed' | 'negotiating'
  industry: 'manufacturing', // filter by company industry
  minValue: '1000',
  maxValue: '50000',
  limit: '20',
  offset: '0',
});

const res = await fetch(`/api/v1/deals?${params}`, {
  headers: { Authorization: 'Bearer ' + token },
});

const { data } = await res.json();
// {
//   deals: [{ id, dealName, dealValue, companyName, ... }],
//   pagination: { total, limit, offset, hasMore }
// }
```

---

## Creating a Deal

```javascript
const res = await fetch('/api/v1/deals', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    dealName: 'Steel Supply RFQ',
    dealDescription: 'Looking for steel suppliers for Q2 production...',
    dealValue: 50000, // optional estimated value
    dealType: 'rfq', // 'auction' | 'rfq'
  }),
});

const { data: deal } = await res.json();
```

---

## Submitting a Bid

```javascript
const res = await fetch(`/api/v1/deals/${dealId}/requests`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    requestDetails: 'We can supply high-grade steel at competitive prices...',
    requestOffer: 45000, // your offer price
  }),
});

const { data: request } = await res.json();
```

---

## Viewing Bids (Deal Owner)

```javascript
const res = await fetch(`/api/v1/deals/${dealId}/requests`, {
  headers: { Authorization: 'Bearer ' + token },
});

const { data } = await res.json();
// {
//   requests: [{ id, applicantCompanyName, requestOffer, status, ... }],
//   stats: { total, pending, accepted, rejected, lowestOffer, highestOffer }
// }
```

---

## Accepting/Rejecting Bids

```javascript
const res = await fetch(`/api/v1/deals/${dealId}/requests/${requestId}/status`, {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'accepted', // 'accepted' | 'rejected'
  }),
});
```

> When a request is accepted, the deal status automatically changes to "negotiating".

---

## Deal Types

| Type      | Description                                     |
| --------- | ----------------------------------------------- |
| `auction` | Competitive bidding, lowest offer usually wins  |
| `rfq`     | Request for Quotation, evaluate multiple offers |

## Deal Statuses

| Status        | Description                               |
| ------------- | ----------------------------------------- |
| `open`        | Accepting new bids/requests               |
| `negotiating` | At least one bid accepted, in discussions |
| `closed`      | Deal completed                            |
| `archived`    | Deal withdrawn/cancelled                  |

## Request Statuses

| Status      | Description         |
| ----------- | ------------------- |
| `pending`   | Awaiting review     |
| `accepted`  | Deal owner accepted |
| `rejected`  | Deal owner declined |
| `withdrawn` | Applicant withdrew  |

---

## React Component Example

```jsx
function DealCard({ deal }) {
  return (
    <div className="deal-card">
      <h3>{deal.dealName}</h3>
      <span className="badge">{deal.dealType.toUpperCase()}</span>
      <p>{deal.dealDescription}</p>

      {deal.dealValue && (
        <div className="value">Est. Value: ${deal.dealValue.toLocaleString()}</div>
      )}

      <div className="company">
        <img src={deal.companyLogo} alt="" />
        <span>{deal.companyName}</span>
      </div>

      <button onClick={() => submitBid(deal.id)}>Submit Bid</button>
    </div>
  );
}
```

---

## Email Notifications

The system sends emails for:

- New bid received on your deal
- Your bid was accepted/rejected

No frontend action required - handled automatically.

---

## Error Handling

```javascript
try {
  const res = await fetch('/api/v1/deals', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(dealData),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }
} catch (err) {
  // Handle errors
  if (err.message.includes('Company must be active')) {
    // Redirect to company verification
  }
}
```

---

## Best Practices

1. **Pagination**: Load deals in batches (20-50 per page)
2. **Filters**: Let users filter by type, industry, value range
3. **Real-time**: Use chat to discuss deals after bid accepted
4. **Offline**: Cache viewed deals for offline reading

---

## Flutter (Dart) Integration

### Deal Model

```dart
class Deal {
  final int id;
  final int companyId;
  final String dealName;
  final String? dealDescription;
  final double? dealValue;
  final String dealType; // 'auction' | 'rfq'
  final String status;   // 'open' | 'closed' | 'negotiating' | 'archived'
  final String? companyName;
  final String? companyLogo;
  final DateTime createdAt;

  Deal({
    required this.id,
    required this.companyId,
    required this.dealName,
    this.dealDescription,
    this.dealValue,
    required this.dealType,
    required this.status,
    this.companyName,
    this.companyLogo,
    required this.createdAt,
  });

  factory Deal.fromJson(Map<String, dynamic> json) {
    return Deal(
      id: json['id'],
      companyId: json['companyId'],
      dealName: json['dealName'],
      dealDescription: json['dealDescription'],
      dealValue: json['dealValue']?.toDouble(),
      dealType: json['dealType'],
      status: json['status'],
      companyName: json['companyName'],
      companyLogo: json['companyLogo'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
```

### Deals Service

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class DealsService {
  static const String _baseUrl = 'https://api.indeal.com/api/v1';

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  /// Search deals with filters
  Future<Map<String, dynamic>> searchDeals({
    String? keyword,
    String? dealType,
    String? status,
    String? industry,
    double? minValue,
    double? maxValue,
    int limit = 20,
    int offset = 0,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
      if (keyword != null) 'keyword': keyword,
      if (dealType != null) 'dealType': dealType,
      if (status != null) 'status': status,
      if (industry != null) 'industry': industry,
      if (minValue != null) 'minValue': minValue.toString(),
      if (maxValue != null) 'maxValue': maxValue.toString(),
    };

    final uri = Uri.parse('$_baseUrl/deals').replace(queryParameters: params);
    final token = await _getToken();

    final response = await http.get(uri, headers: {
      if (token != null) 'Authorization': 'Bearer $token',
    });

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      return {
        'deals': (data['deals'] as List).map((j) => Deal.fromJson(j)).toList(),
        'pagination': data['pagination'],
      };
    }
    throw Exception('Failed to load deals');
  }

  /// Create a new deal
  Future<Deal> createDeal({
    required String dealName,
    required String dealType,
    String? dealDescription,
    double? dealValue,
  }) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$_baseUrl/deals'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'dealName': dealName,
        'dealType': dealType,
        if (dealDescription != null) 'dealDescription': dealDescription,
        if (dealValue != null) 'dealValue': dealValue,
      }),
    );

    if (response.statusCode == 201) {
      return Deal.fromJson(jsonDecode(response.body)['data']);
    }
    throw Exception('Failed to create deal');
  }

  /// Submit a bid on a deal
  Future<void> submitBid(int dealId, {
    required String requestDetails,
    double? requestOffer,
  }) async {
    final token = await _getToken();

    final response = await http.post(
      Uri.parse('$_baseUrl/deals/$dealId/requests'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'requestDetails': requestDetails,
        if (requestOffer != null) 'requestOffer': requestOffer,
      }),
    );

    if (response.statusCode != 201) {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? 'Failed to submit bid');
    }
  }
}
```

### Flutter Widget Example

```dart
class DealCard extends StatelessWidget {
  final Deal deal;
  final VoidCallback onSubmitBid;

  const DealCard({
    super.key,
    required this.deal,
    required this.onSubmitBid,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    deal.dealName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Chip(
                  label: Text(deal.dealType.toUpperCase()),
                  backgroundColor: deal.dealType == 'auction'
                      ? Colors.orange.shade100
                      : Colors.blue.shade100,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (deal.dealDescription != null)
              Text(
                deal.dealDescription!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            const SizedBox(height: 8),
            if (deal.dealValue != null)
              Text(
                'Est. Value: \$${deal.dealValue!.toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (deal.companyLogo != null)
                  CircleAvatar(
                    backgroundImage: NetworkImage(deal.companyLogo!),
                    radius: 12,
                  ),
                const SizedBox(width: 8),
                Text(deal.companyName ?? 'Unknown'),
                const Spacer(),
                ElevatedButton(
                  onPressed: onSubmitBid,
                  child: const Text('Submit Bid'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

### Deals List Screen

```dart
class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  final DealsService _dealsService = DealsService();
  List<Deal> _deals = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDeals();
  }

  Future<void> _loadDeals() async {
    try {
      final result = await _dealsService.searchDeals(status: 'open');
      setState(() {
        _deals = result['deals'] as List<Deal>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView.builder(
      itemCount: _deals.length,
      itemBuilder: (context, index) {
        return DealCard(
          deal: _deals[index],
          onSubmitBid: () => _showBidDialog(_deals[index]),
        );
      },
    );
  }

  void _showBidDialog(Deal deal) {
    // Show dialog to submit bid
  }
}
```
