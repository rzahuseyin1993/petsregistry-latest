export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_messages: {
        Row: {
          attachment_urls: Json | null
          audience_group: string | null
          created_at: string
          id: string
          is_html: boolean
          is_paused: boolean
          is_read: boolean
          message: string
          recipient_id: string
          sender_id: string
          subject: string
        }
        Insert: {
          attachment_urls?: Json | null
          audience_group?: string | null
          created_at?: string
          id?: string
          is_html?: boolean
          is_paused?: boolean
          is_read?: boolean
          message: string
          recipient_id: string
          sender_id: string
          subject?: string
        }
        Update: {
          attachment_urls?: Json | null
          audience_group?: string | null
          created_at?: string
          id?: string
          is_html?: boolean
          is_paused?: boolean
          is_read?: boolean
          message?: string
          recipient_id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: []
      }
      adoption_transfer_history: {
        Row: {
          action: string
          actor_id: string
          adoption_id: string
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          adoption_id: string
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          adoption_id?: string
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adoption_transfer_history_adoption_id_fkey"
            columns: ["adoption_id"]
            isOneToOne: false
            referencedRelation: "pet_adoptions"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          featured_until: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          moderation_status: string
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured_until?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          moderation_status?: string
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured_until?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          moderation_status?: string
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_listing_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          listing_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          listing_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          listing_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      business_listings: {
        Row: {
          address: string | null
          category: string
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          is_featured: boolean
          is_paid: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
          video_url: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          is_featured?: boolean
          is_paid?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
          video_url?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          is_featured?: boolean
          is_paid?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
          video_url?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      certificate_credits: {
        Row: {
          created_at: string
          credits: number
          free_credit_claimed: boolean
          id: string
          lifetime_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          free_credit_claimed?: boolean
          id?: string
          lifetime_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          free_credit_claimed?: boolean
          id?: string
          lifetime_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          background_url: string | null
          colors: Json
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          colors?: Json
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          colors?: Json
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          created_at: string
          css_content: string
          gjs_data: Json
          html_content: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          css_content?: string
          gjs_data?: Json
          html_content?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          css_content?: string
          gjs_data?: Json
          html_content?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_reply: string | null
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          replied_at: string | null
          source: string | null
          subject: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          replied_at?: string | null
          source?: string | null
          subject?: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          replied_at?: string | null
          source?: string | null
          subject?: string
        }
        Relationships: []
      }
      donation_packages: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          donor_email: string | null
          donor_name: string | null
          id: string
          message: string | null
          package_id: string | null
          payment_id: string | null
          payment_method: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          package_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          package_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "donation_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      flyer_subscriptions: {
        Row: {
          billing_interval: string
          created_at: string
          expires_at: string
          id: string
          payment_id: string | null
          price: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          expires_at: string
          id?: string
          payment_id?: string | null
          price?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          price?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flyer_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          name: string
          template_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          template_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          template_type?: string
        }
        Relationships: []
      }
      lost_reports: {
        Row: {
          contact_phone: string | null
          created_at: string
          description: string | null
          guest_email: string | null
          guest_name: string | null
          guest_pet_breed: string | null
          guest_pet_name: string | null
          guest_pet_photo_url: string | null
          guest_pet_species: string | null
          guest_phone: string | null
          id: string
          is_guest: boolean
          is_paused: boolean
          last_seen_address: string | null
          last_seen_lat: number | null
          last_seen_lng: number | null
          pet_id: string
          reporter_id: string | null
          reward: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_pet_breed?: string | null
          guest_pet_name?: string | null
          guest_pet_photo_url?: string | null
          guest_pet_species?: string | null
          guest_phone?: string | null
          id?: string
          is_guest?: boolean
          is_paused?: boolean
          last_seen_address?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          pet_id: string
          reporter_id?: string | null
          reward?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_pet_breed?: string | null
          guest_pet_name?: string | null
          guest_pet_photo_url?: string | null
          guest_pet_species?: string | null
          guest_phone?: string | null
          id?: string
          is_guest?: boolean
          is_paused?: boolean
          last_seen_address?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          pet_id?: string
          reporter_id?: string | null
          reward?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_reports_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_reports_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      map_custom_pins: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string | null
          emoji: string
          icon_url: string | null
          id: string
          is_active: boolean
          lat: number
          lng: number
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          badge_icon_url: string | null
          created_at: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          monthly_price: number | null
          name: string
          plan_type: string
          price: number
          slug: string
          stripe_monthly_price_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
        }
        Insert: {
          badge_icon_url?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name: string
          plan_type?: string
          price?: number
          slug: string
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Update: {
          badge_icon_url?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          name?: string
          plan_type?: string
          price?: number
          slug?: string
          stripe_monthly_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          billing_interval: string
          created_at: string
          expires_at: string
          id: string
          payment_id: string | null
          plan_id: string
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          expires_at: string
          id?: string
          payment_id?: string | null
          plan_id: string
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan_id?: string
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          audience_type: string
          body: string
          created_at: string
          created_by: string
          id: string
          is_html: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience_type?: string
          body?: string
          created_at?: string
          created_by: string
          id?: string
          is_html?: boolean
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          audience_type?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_html?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_flags: {
        Row: {
          auto_paused: boolean
          confidence: number
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          owner_user_id: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          suggested_action: string
          updated_at: string
        }
        Insert: {
          auto_paused?: boolean
          confidence?: number
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: string
          owner_user_id?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          suggested_action?: string
          updated_at?: string
        }
        Update: {
          auto_paused?: boolean
          confidence?: number
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          owner_user_id?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          suggested_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          id: string
          owner_user_id: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          id?: string
          owner_user_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: string
          owner_user_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          payment_id: string | null
          payment_method: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id?: string | null
          payment_method?: string | null
          status?: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string | null
          payment_method?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          id: string
          is_active: boolean
          provider: string
          publishable_key: string | null
          secret_key: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          provider: string
          publishable_key?: string | null
          secret_key?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          provider?: string
          publishable_key?: string | null
          secret_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pet_adoptions: {
        Row: {
          admin_approved: boolean
          adopter_confirmed: boolean
          adopter_id: string | null
          adoption_fee: number | null
          created_at: string
          description: string | null
          id: string
          owner_confirmed: boolean
          owner_id: string
          pet_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean
          adopter_confirmed?: boolean
          adopter_id?: string | null
          adoption_fee?: number | null
          created_at?: string
          description?: string | null
          id?: string
          owner_confirmed?: boolean
          owner_id: string
          pet_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean
          adopter_confirmed?: boolean
          adopter_id?: string | null
          adoption_fee?: number | null
          created_at?: string
          description?: string | null
          id?: string
          owner_confirmed?: boolean
          owner_id?: string
          pet_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_adoptions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_adoptions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_certificates: {
        Row: {
          certificate_number: string | null
          created_at: string
          css_content: string
          design_data: Json
          html_content: string
          id: string
          is_paid: boolean
          is_paused: boolean
          issued_at: string | null
          payment_id: string | null
          pet_id: string
          status: string
          template_id: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          css_content?: string
          design_data?: Json
          html_content?: string
          id?: string
          is_paid?: boolean
          is_paused?: boolean
          issued_at?: string | null
          payment_id?: string | null
          pet_id: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
          verification_code?: string | null
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          css_content?: string
          design_data?: Json
          html_content?: string
          id?: string
          is_paid?: boolean
          is_paused?: boolean
          issued_at?: string | null
          payment_id?: string | null
          pet_id?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_certificates_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_certificates_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_health_records: {
        Row: {
          created_at: string
          height_cm: number | null
          id: string
          notes: string | null
          pet_id: string
          record_date: string
          temperature: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          pet_id: string
          record_date?: string
          temperature?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          pet_id?: string
          record_date?: string
          temperature?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          pet_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          pet_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          pet_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_images_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_images_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_scan_logs: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          pet_id: string
          scanner_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          pet_id: string
          scanner_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          pet_id?: string
          scanner_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      pet_vaccinations: {
        Row: {
          created_at: string
          date_given: string
          id: string
          next_due_date: string | null
          notes: string | null
          pet_id: string
          vaccine_name: string
          vet_name: string | null
        }
        Insert: {
          created_at?: string
          date_given: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          pet_id: string
          vaccine_name: string
          vet_name?: string | null
        }
        Update: {
          created_at?: string
          date_given?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          pet_id?: string
          vaccine_name?: string
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age: string | null
          breed: string | null
          color: string | null
          created_at: string
          id: string
          is_paused: boolean
          microchip_number: string | null
          name: string
          notes: string | null
          owner_id: string
          pet_code: string | null
          species: string
          status: string
          updated_at: string
          weight: string | null
        }
        Insert: {
          age?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_paused?: boolean
          microchip_number?: string | null
          name: string
          notes?: string | null
          owner_id: string
          pet_code?: string | null
          species: string
          status?: string
          updated_at?: string
          weight?: string | null
        }
        Update: {
          age?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_paused?: boolean
          microchip_number?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          pet_code?: string | null
          species?: string
          status?: string
          updated_at?: string
          weight?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_paused: boolean
          phone: string | null
          race: string | null
          show_name: boolean
          show_phone: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_paused?: boolean
          phone?: string | null
          race?: string | null
          show_name?: boolean
          show_phone?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_paused?: boolean
          phone?: string | null
          race?: string | null
          show_name?: boolean
          show_phone?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      certificate_verification: {
        Row: {
          breed: string | null
          certificate_number: string | null
          id: string | null
          is_paid: boolean | null
          issued_at: string | null
          pet_code: string | null
          pet_name: string | null
          species: string | null
          verification_code: string | null
        }
        Relationships: []
      }
      lost_reports_public: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          last_seen_address: string | null
          last_seen_lat: number | null
          last_seen_lng: number | null
          pet_id: string | null
          reporter_id: string | null
          reward: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          last_seen_address?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          pet_id?: string | null
          reporter_id?: string | null
          reward?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          last_seen_address?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          pet_id?: string | null
          reporter_id?: string | null
          reward?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lost_reports_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_reports_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings_safe: {
        Row: {
          id: string | null
          is_active: boolean | null
          provider: string | null
          publishable_key: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          provider?: string | null
          publishable_key?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          provider?: string | null
          publishable_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pets_public: {
        Row: {
          age: string | null
          breed: string | null
          color: string | null
          created_at: string | null
          id: string | null
          name: string | null
          owner_id: string | null
          pet_code: string | null
          species: string | null
          status: string | null
          updated_at: string | null
          weight: string | null
        }
        Insert: {
          age?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          owner_id?: string | null
          pet_code?: string | null
          species?: string | null
          status?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Update: {
          age?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          owner_id?: string | null
          pet_code?: string | null
          species?: string | null
          status?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      claim_free_certificate_credit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      consume_certificate_credit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      deduct_stock: {
        Args: { _product_id: string; _quantity: number }
        Returns: undefined
      }
      get_public_profile: { Args: { _user_id: string }; Returns: Json }
      grant_certificate_credit: {
        Args: { _amount: number; _is_purchase?: boolean; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_system_notification: {
        Args: {
          _link?: string
          _message: string
          _metadata?: Json
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: undefined
      }
      search_pet_by_microchip: {
        Args: { _chip: string }
        Returns: {
          id: string
        }[]
      }
      search_pets_global: {
        Args: { _query: string }
        Returns: {
          id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "seo_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "seo_admin"],
    },
  },
} as const
