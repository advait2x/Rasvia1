-- ============================================================================
-- SEED DATA: Indian restaurants in Frisco, TX area
-- Paste into the Supabase SQL Editor after the schema is created.
-- ============================================================================

-- ── Restaurants ─────────────────────────────────────────────────────────────

INSERT INTO public.restaurants (name, address, description, image_url, current_wait_time, is_waitlist_open, rating, price_range, cuisine_tags, lat, long, is_featured, is_enabled, waitlist_open) VALUES
(
  'Biryani Pot',
  '3685 Preston Rd, Frisco, TX 75034',
  'Authentic Hyderabadi biryani and kebabs. Famous for our slow-cooked dum biryani with saffron-infused basmati rice.',
  'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
  15, true, 4.6, '$$',
  ARRAY['Indian', 'Biryani', 'Hyderabadi'],
  33.1507, -96.8236, true, true, true
),
(
  'Tandoori Nights',
  '5355 Dallas Pkwy, Frisco, TX 75034',
  'North Indian cuisine with tandoor-grilled specialties. Live kitchen, craft cocktails, and weekend brunch buffet.',
  'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
  25, true, 4.4, '$$$',
  ARRAY['Indian', 'North Indian', 'Tandoor'],
  33.1180, -96.8209, true, true, true
),
(
  'Dosa Factory',
  '2500 Legacy Dr, Frisco, TX 75034',
  'South Indian street food — crispy dosas, fluffy idlis, and filter coffee. Quick service, big flavors.',
  'https://images.unsplash.com/photo-1630383249896-424e482df921?w=800',
  10, true, 4.5, '$',
  ARRAY['Indian', 'South Indian', 'Dosa', 'Vegetarian'],
  33.1290, -96.8130, false, true, true
),
(
  'Spice Route',
  '8980 TX-121, Frisco, TX 75035',
  'Modern Indian fusion with a Texas twist. Small plates, craft drinks, and a curated tasting menu on weekends.',
  'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
  30, true, 4.7, '$$$',
  ARRAY['Indian', 'Fusion', 'Modern Indian'],
  33.1650, -96.7950, true, true, true
),
(
  'Chaat Street',
  '4150 Legacy Dr, Frisco, TX 75034',
  'Mumbai-style street food — pani puri, vada pav, pav bhaji, and loaded chaat. Casual, colorful, and fun.',
  'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=800',
  5, true, 4.3, '$',
  ARRAY['Indian', 'Street Food', 'Chaat', 'Vegetarian'],
  33.1350, -96.8100, false, true, true
);

-- ── Restaurant Hours (all restaurants, Mon–Sun) ─────────────────────────────

-- Biryani Pot (ID 1) — 11am–10pm daily
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(1, 0, '11:00', '22:00'), (1, 1, '11:00', '22:00'), (1, 2, '11:00', '22:00'),
(1, 3, '11:00', '22:00'), (1, 4, '11:00', '22:00'), (1, 5, '11:00', '23:00'),
(1, 6, '11:00', '23:00');

-- Tandoori Nights (ID 2) — 11:30am–10:30pm, Fri/Sat till 11:30pm
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(2, 0, '11:30', '22:30'), (2, 1, '11:30', '22:30'), (2, 2, '11:30', '22:30'),
(2, 3, '11:30', '22:30'), (2, 4, '11:30', '22:30'), (2, 5, '11:30', '23:30'),
(2, 6, '11:30', '23:30');

-- Dosa Factory (ID 3) — 8am–9pm (breakfast hours!)
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(3, 0, '08:00', '21:00'), (3, 1, '08:00', '21:00'), (3, 2, '08:00', '21:00'),
(3, 3, '08:00', '21:00'), (3, 4, '08:00', '21:00'), (3, 5, '08:00', '22:00'),
(3, 6, '08:00', '22:00');

-- Spice Route (ID 4) — 5pm–11pm (dinner only, closed Mon)
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(4, 0, '17:00', '23:00'), (4, 2, '17:00', '23:00'), (4, 3, '17:00', '23:00'),
(4, 4, '17:00', '23:00'), (4, 5, '17:00', '00:00'), (4, 6, '17:00', '00:00');

-- Chaat Street (ID 5) — 10am–9pm daily
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(5, 0, '10:00', '21:00'), (5, 1, '10:00', '21:00'), (5, 2, '10:00', '21:00'),
(5, 3, '10:00', '21:00'), (5, 4, '10:00', '21:00'), (5, 5, '10:00', '22:00'),
(5, 6, '10:00', '22:00');

-- ── Menu Categories ─────────────────────────────────────────────────────────

-- Biryani Pot
INSERT INTO public.menu_categories (restaurant_id, name, sort_order) VALUES
(1, 'Biryanis', 1), (1, 'Kebabs & Starters', 2), (1, 'Curries', 3), (1, 'Breads', 4), (1, 'Drinks', 5);

-- Tandoori Nights
INSERT INTO public.menu_categories (restaurant_id, name, sort_order) VALUES
(2, 'Tandoor Specials', 1), (2, 'Curries', 2), (2, 'Rice & Breads', 3), (2, 'Desserts', 4);

-- Dosa Factory
INSERT INTO public.menu_categories (restaurant_id, name, sort_order) VALUES
(3, 'Dosas', 1), (3, 'Idli & Vada', 2), (3, 'Uttapam', 3), (3, 'Beverages', 4);

-- Spice Route
INSERT INTO public.menu_categories (restaurant_id, name, sort_order) VALUES
(4, 'Small Plates', 1), (4, 'Mains', 2), (4, 'Sides', 3), (4, 'Cocktails', 4);

-- Chaat Street
INSERT INTO public.menu_categories (restaurant_id, name, sort_order) VALUES
(5, 'Chaat', 1), (5, 'Sandwiches & Wraps', 2), (5, 'Mains', 3), (5, 'Drinks', 4);

-- ── Menu Items ──────────────────────────────────────────────────────────────

-- ═══ Biryani Pot (restaurant_id = 1) ═══
INSERT INTO public.menu_items (restaurant_id, name, description, price, is_vegetarian, is_spicy, category, meal_times, in_stock) VALUES
-- Biryanis
(1, 'Hyderabadi Chicken Dum Biryani', 'Slow-cooked with saffron, fried onions, and whole spices. Served with raita & mirchi ka salan.', 18.99, false, true, 'Biryanis', ARRAY['lunch','dinner'], true),
(1, 'Goat Biryani', 'Tender goat pieces marinated overnight, layered with aromatic basmati rice.', 22.99, false, true, 'Biryanis', ARRAY['lunch','dinner'], true),
(1, 'Vegetable Dum Biryani', 'Seasonal vegetables with paneer in fragrant rice. 100% vegetarian.', 15.99, true, false, 'Biryanis', ARRAY['lunch','dinner'], true),
(1, 'Egg Biryani', 'Boiled eggs simmered in spiced masala gravy, layered with basmati rice.', 14.99, false, false, 'Biryanis', ARRAY['lunch','dinner'], true),
-- Kebabs
(1, 'Seekh Kebab (6 pcs)', 'Minced lamb skewers grilled over charcoal. Served with mint chutney.', 13.99, false, true, 'Kebabs & Starters', ARRAY['lunch','dinner'], true),
(1, 'Chicken 65', 'Crispy fried chicken tossed in curry leaves, chili, and ginger.', 12.99, false, true, 'Kebabs & Starters', ARRAY['lunch','dinner'], true),
(1, 'Paneer Tikka (8 pcs)', 'Marinated cottage cheese cubes grilled in tandoor with bell peppers.', 11.99, true, false, 'Kebabs & Starters', ARRAY['lunch','dinner'], true),
-- Curries
(1, 'Butter Chicken', 'Tandoori chicken in creamy tomato-butter sauce. A classic.', 16.99, false, false, 'Curries', ARRAY['lunch','dinner'], true),
(1, 'Lamb Rogan Josh', 'Kashmiri-style lamb curry slow-cooked with aromatic spices.', 19.99, false, true, 'Curries', ARRAY['dinner'], true),
(1, 'Dal Makhani', 'Black lentils simmered overnight with butter and cream.', 12.99, true, false, 'Curries', ARRAY['lunch','dinner'], true),
-- Breads
(1, 'Garlic Naan', 'Soft naan brushed with garlic butter.', 3.99, true, false, 'Breads', ARRAY['lunch','dinner'], true),
(1, 'Butter Roti', 'Whole wheat flatbread with a touch of butter.', 2.99, true, false, 'Breads', ARRAY['lunch','dinner'], true),
-- Drinks
(1, 'Mango Lassi', 'Thick yogurt smoothie with Alphonso mango pulp.', 5.99, true, false, 'Drinks', ARRAY['lunch','dinner'], true),
(1, 'Masala Chai', 'Strong black tea with cardamom, ginger, and cinnamon.', 3.99, true, false, 'Drinks', ARRAY['lunch','dinner'], true);

-- ═══ Tandoori Nights (restaurant_id = 2) ═══
INSERT INTO public.menu_items (restaurant_id, name, description, price, is_vegetarian, is_spicy, category, meal_times, in_stock) VALUES
(2, 'Tandoori Chicken (Half)', 'Yogurt-marinated chicken roasted in clay oven. Smoky and juicy.', 14.99, false, true, 'Tandoor Specials', ARRAY['lunch','dinner'], true),
(2, 'Lamb Chops (4 pcs)', 'French-cut lamb chops marinated in mint and spices, chargrilled.', 24.99, false, true, 'Tandoor Specials', ARRAY['dinner'], true),
(2, 'Fish Tikka', 'Salmon fillet marinated in ajwain and lemon, tandoor-roasted.', 19.99, false, false, 'Tandoor Specials', ARRAY['dinner'], true),
(2, 'Chicken Tikka Masala', 'Chargrilled chicken chunks in rich, creamy tomato gravy.', 17.99, false, false, 'Curries', ARRAY['lunch','dinner'], true),
(2, 'Palak Paneer', 'Cottage cheese cubes in smooth spinach gravy with garlic.', 14.99, true, false, 'Curries', ARRAY['lunch','dinner'], true),
(2, 'Chana Masala', 'Chickpeas simmered in tangy tomato-onion gravy with cumin.', 12.99, true, true, 'Curries', ARRAY['lunch','dinner'], true),
(2, 'Peshawari Naan', 'Stuffed with coconut, almonds, and raisins. Sweet and savory.', 4.99, true, false, 'Rice & Breads', ARRAY['lunch','dinner'], true),
(2, 'Jeera Rice', 'Basmati rice tempered with cumin seeds and ghee.', 5.99, true, false, 'Rice & Breads', ARRAY['lunch','dinner'], true),
(2, 'Gulab Jamun (3 pcs)', 'Deep-fried milk dumplings soaked in rose-cardamom syrup.', 6.99, true, false, 'Desserts', ARRAY['lunch','dinner'], true),
(2, 'Rasmalai (2 pcs)', 'Soft paneer discs in chilled saffron-pistachio milk.', 7.99, true, false, 'Desserts', ARRAY['lunch','dinner'], true);

-- ═══ Dosa Factory (restaurant_id = 3) ═══
INSERT INTO public.menu_items (restaurant_id, name, description, price, is_vegetarian, is_spicy, category, meal_times, in_stock) VALUES
(3, 'Classic Masala Dosa', 'Crispy rice-lentil crepe filled with spiced potato. Served with sambar & coconut chutney.', 10.99, true, false, 'Dosas', ARRAY['breakfast','lunch','dinner'], true),
(3, 'Mysore Masala Dosa', 'Extra-crispy dosa with spicy red chutney spread inside.', 12.99, true, true, 'Dosas', ARRAY['breakfast','lunch','dinner'], true),
(3, 'Rava Dosa', 'Semolina crepe — thin, lacy, and crispy. Light and delicious.', 11.99, true, false, 'Dosas', ARRAY['breakfast','lunch','dinner'], true),
(3, 'Cheese Dosa', 'Cheddar and mozzarella melted inside a golden dosa.', 13.99, true, false, 'Dosas', ARRAY['breakfast','lunch','dinner'], true),
(3, 'Idli Sambar (4 pcs)', 'Steamed rice cakes with lentil soup and chutneys.', 8.99, true, false, 'Idli & Vada', ARRAY['breakfast','lunch'], true),
(3, 'Medu Vada (3 pcs)', 'Crispy lentil doughnuts with sambar and chutney.', 7.99, true, false, 'Idli & Vada', ARRAY['breakfast','lunch'], true),
(3, 'Onion Uttapam', 'Thick rice pancake topped with onions, tomatoes, and chili.', 10.99, true, true, 'Uttapam', ARRAY['breakfast','lunch'], true),
(3, 'Filter Coffee', 'Strong South Indian coffee brewed with chicory. Frothy and bold.', 4.49, true, false, 'Beverages', ARRAY['breakfast','lunch','dinner'], true),
(3, 'Fresh Lime Soda', 'Lime juice with soda water — sweet or salted.', 3.99, true, false, 'Beverages', ARRAY['breakfast','lunch','dinner'], true);

-- ═══ Spice Route (restaurant_id = 4) ═══
INSERT INTO public.menu_items (restaurant_id, name, description, price, is_vegetarian, is_spicy, category, meal_times, in_stock) VALUES
(4, 'Avocado Bhel', 'Puffed rice, avocado, pomegranate, date-tamarind chutney. Light and refreshing.', 12.99, true, false, 'Small Plates', ARRAY['dinner'], true),
(4, 'Lamb Keema Sliders (3)', 'Spiced lamb mince on brioche buns with pickled onion and raita.', 16.99, false, true, 'Small Plates', ARRAY['dinner'], true),
(4, 'Truffle Naan Bites', 'Mini garlic naans drizzled with truffle oil and Parmesan.', 10.99, true, false, 'Small Plates', ARRAY['dinner'], true),
(4, 'Saffron Butter Lobster', 'Lobster tail in saffron-butter sauce with charred lemon.', 38.99, false, false, 'Mains', ARRAY['dinner'], true),
(4, 'Smoked Lamb Shank', '12-hour smoked lamb shank glazed with tamarind-jaggery.', 32.99, false, true, 'Mains', ARRAY['dinner'], true),
(4, 'Paneer Steak', 'Thick-cut paneer seared on cast iron with chimichurri.', 22.99, true, false, 'Mains', ARRAY['dinner'], true),
(4, 'Sweet Potato Raita', 'Roasted sweet potato with spiced yogurt and pomegranate.', 7.99, true, false, 'Sides', ARRAY['dinner'], true),
(4, 'Tamarind Margarita', 'Tequila, tamarind, lime, chili-salt rim.', 14.99, true, true, 'Cocktails', ARRAY['dinner'], true),
(4, 'Mango Lassi Martini', 'Vodka, mango pulp, cardamom, cream.', 15.99, true, false, 'Cocktails', ARRAY['dinner'], true);

-- ═══ Chaat Street (restaurant_id = 5) ═══
INSERT INTO public.menu_items (restaurant_id, name, description, price, is_vegetarian, is_spicy, category, meal_times, in_stock) VALUES
(5, 'Pani Puri (8 pcs)', 'Crispy shells filled with spiced water, potato, and chickpeas. The OG street food.', 7.99, true, true, 'Chaat', ARRAY['lunch','dinner'], true),
(5, 'Sev Puri (6 pcs)', 'Flat puris topped with potato, onion, chutneys, and sev.', 8.99, true, false, 'Chaat', ARRAY['lunch','dinner'], true),
(5, 'Bhel Puri', 'Puffed rice tossed with onion, tomato, and tangy tamarind chutney.', 7.99, true, false, 'Chaat', ARRAY['lunch','dinner'], true),
(5, 'Loaded Aloo Tikki', 'Crispy potato patties topped with chole, yogurt, and chutneys.', 9.99, true, true, 'Chaat', ARRAY['lunch','dinner'], true),
(5, 'Vada Pav', 'Mumbai-style spiced potato fritter in a soft bun with garlic chutney.', 6.99, true, true, 'Sandwiches & Wraps', ARRAY['lunch','dinner'], true),
(5, 'Paneer Kathi Roll', 'Spiced paneer wrapped in a flaky paratha with onions and chutney.', 10.99, true, false, 'Sandwiches & Wraps', ARRAY['lunch','dinner'], true),
(5, 'Chicken Kathi Roll', 'Tandoori chicken wrapped in egg paratha with mint chutney.', 11.99, false, true, 'Sandwiches & Wraps', ARRAY['lunch','dinner'], true),
(5, 'Pav Bhaji', 'Spiced mixed-vegetable mash with buttered pav buns. Mumbai comfort food.', 11.99, true, true, 'Mains', ARRAY['lunch','dinner'], true),
(5, 'Chole Bhature', 'Spicy chickpea curry with puffy fried bread.', 12.99, true, true, 'Mains', ARRAY['lunch','dinner'], true),
(5, 'Masala Lemonade', 'Fresh lemonade with cumin, black salt, and mint.', 4.99, true, false, 'Drinks', ARRAY['lunch','dinner'], true),
(5, 'Rose Falooda', 'Rose syrup milkshake with vermicelli, basil seeds, and ice cream.', 7.99, true, false, 'Drinks', ARRAY['lunch','dinner'], true);

-- ── System Config ───────────────────────────────────────────────────────────

INSERT INTO public.system_config (key, value) VALUES
('platform_name', 'Rasvia'),
('default_wait_time', '15'),
('max_party_size', '20');
