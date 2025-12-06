# Database Schema (ERD)

This document describes the database schema for the Molding Shop Status application.

## Entity Relationship Diagram

```mermaid
erDiagram
    machines ||--o{ status_logs : "has"
    machines ||--o{ machine_parts : "has"
    machines ||--o{ production_orders : "runs"
    machines ||--o{ downtime_logs : "has"
    machines ||--o{ production_logs : "has"
    
    parts ||--o{ machine_parts : "produced by"
    parts ||--o{ production_orders : "ordered as"
    
    production_orders ||--o{ production_logs : "logged in"
    
    shifts ||--o{ shift_breaks : "has"
    shifts ||--o{ shift_instances : "instantiated as"
    
    plant_calendar ||--o{ shift_instances : "schedules"
    
    shift_instances ||--o{ shift_instance_breaks : "has"
    shift_instances ||--o{ production_logs : "contains"
    shift_instances ||--o{ downtime_logs : "contains"
    
    downtime_reasons ||--o{ downtime_logs : "categorizes"
    
    scrap_reasons ||--o{ production_log_scraps : "categorizes"
    production_logs ||--o{ production_log_scraps : "has"

    machines {
        serial machine_id PK
        text machine_name
        text status
        boolean green
        boolean red
        integer cycle_count
        text input_mode
        text production_order FK
        text part_number
        text part_name
        real target_cycle_time
        integer parts_per_cycle
        text brand
        text model
        text serial_no
        integer tonnage
        real screw_diameter
        real injection_weight
        boolean is_2k
        text floor_row
        integer floor_position
        timestamp last_seen
        timestamp created_at
    }

    parts {
        text part_number PK
        text part_name
        text image_url
        text product_line
        integer default_machine_id FK
        timestamp created_at
    }

    machine_parts {
        serial id PK
        integer machine_id FK
        text part_number FK
        integer cavity_plan
        real target_cycle_time
    }

    production_orders {
        text order_number PK
        text part_number FK
        integer quantity_required
        integer quantity_completed
        integer machine_id FK
        text status
        real target_cycle_time
        integer target_utilization
        timestamp due_date
        text notes
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    shifts {
        serial id PK
        text name
        text start_time
        text end_time
        boolean is_active
    }

    shift_breaks {
        serial id PK
        integer shift_id FK
        text name
        text start_time
        text end_time
        boolean is_active
    }

    plant_calendar {
        text date PK
        text day_type
        integer week_num
        text name
        text notes
    }

    shift_instances {
        serial id PK
        integer shift_template_id FK
        text production_date FK
        timestamp planned_start_at
        timestamp planned_end_at
        timestamp actual_start_at
        timestamp actual_end_at
        text status
        boolean is_overtime
        text notes
        timestamp created_at
    }

    shift_instance_breaks {
        serial id PK
        integer shift_instance_id FK
        text name
        timestamp start_time
        timestamp end_time
    }

    production_logs {
        serial id PK
        integer machine_id FK
        text order_number FK
        integer shift_instance_id FK
        integer quantity_produced
        integer quantity_scrap
        timestamp started_at
        timestamp ended_at
        text status
        text logged_by
        text notes
        timestamp created_at
    }

    production_log_scraps {
        serial id PK
        integer production_log_id FK
        integer scrap_reason_id FK
        integer quantity
    }

    scrap_reasons {
        serial id PK
        text code
        text name
        text category
        boolean is_active
        timestamp created_at
    }

    downtime_reasons {
        text code PK
        text name
        text category
        boolean is_active
    }

    downtime_logs {
        serial id PK
        integer machine_id FK
        text reason_code FK
        integer shift_instance_id FK
        text notes
        timestamp started_at
        timestamp ended_at
        integer duration_minutes
    }

    status_logs {
        serial id PK
        integer machine_id FK
        text status
        integer cycle_count
        timestamp timestamp
    }

    product_lines {
        text code PK
        text name
        boolean is_active
    }

    users {
        serial id PK
        text username
        text password_hash
        text name
        text role
        boolean is_active
        timestamp created_at
        timestamp last_login_at
    }
```

## Table Descriptions

| Table | Purpose |
|-------|---------|
| `machines` | Injection molding machines with specs and current status |
| `parts` | Part catalog with images and cycle times |
| `machine_parts` | Machine-to-part capability mappings |
| `production_orders` | Work orders for parts |
| `shifts` | Shift templates (Day, Swing, Night) |
| `shift_breaks` | Break times per shift template |
| `plant_calendar` | Working/non-working days |
| `shift_instances` | Actual shift occurrences per day |
| `shift_instance_breaks` | Actual breaks per shift instance |
| `production_logs` | Production entries per shift |
| `production_log_scraps` | Scrap by reason per log |
| `scrap_reasons` | Defect type lookup |
| `downtime_reasons` | Downtime category lookup |
| `downtime_logs` | Machine downtime events |
| `status_logs` | Historical machine status changes |
| `product_lines` | Product line categories |
| `users` | System users with roles |
