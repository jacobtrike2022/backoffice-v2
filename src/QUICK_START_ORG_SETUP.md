# Quick Start: Organization Setup 🚀

## Step 1: Run Seed Data (One Time)
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `/migrations/seed_districts_stores.sql`
3. Paste into SQL Editor
4. Click **Run**
5. ✅ You should see 4 districts and 9 stores created

---

## Step 2: Access Organization Setup
1. In the app, ensure you're logged in as **Admin** or **Trike Super Admin**
2. Click **"Organization Setup"** in the left sidebar (🔧 wrench icon)
3. You'll see two tabs: **Districts** and **Stores**

---

## Step 3: Manage Districts
### To Create a District:
1. Click **"New District"** button
2. Enter:
   - District Name (e.g., "Southwest District")
   - District Code (e.g., "SW")
3. Click **"Create District"**

### To Edit a District:
1. Click **"Edit"** button next to any district
2. Modify name or code
3. Click **"Save Changes"**

### To Delete a District:
1. Click **"Delete"** button
2. Confirm deletion
3. ⚠️ **Warning:** Make sure no stores are assigned to this district first!

---

## Step 4: Manage Stores
### To Create a Store:
1. Switch to **"Stores"** tab
2. Click **"New Store"** button
3. Enter:
   - Store Name (e.g., "Phoenix Central")
   - Store Code (e.g., "501")
   - Select a District from dropdown
   - *(Optional)* Address, City, State, ZIP Code
4. Click **"Create Store"**

### To Edit a Store:
1. Click **"Edit"** button next to any store
2. Modify any fields
3. Click **"Save Changes"**

### To Delete a Store:
1. Click **"Delete"** button
2. Confirm deletion

---

## 🎯 Current Seed Data

### Districts (4):
- **Northeast (NE)** - 2 stores
- **Southeast (SE)** - 2 stores
- **Midwest (MW)** - 2 stores
- **West Coast (WC)** - 3 stores

### Stores (9):
1. **#101** - Boston Flagship (Northeast)
2. **#102** - New York Times Square (Northeast)
3. **#201** - Atlanta Perimeter (Southeast)
4. **#202** - Miami Beach (Southeast)
5. **#301** - Chicago Magnificent Mile (Midwest)
6. **#302** - Minneapolis Mall of America (Midwest)
7. **#401** - Los Angeles Beverly Center (West Coast)
8. **#402** - San Francisco Union Square (West Coast)
9. **#403** - Seattle Downtown (West Coast)

---

## ⚠️ Important Notes

1. **Districts First:** You must create at least one district before creating stores
2. **Delete Order:** Delete stores before deleting their district
3. **Unique Codes:** District codes and store codes should be unique
4. **Admin Only:** Only Admin and Trike Super Admin roles can access this page

---

## 🔍 Verification
After running seed data, verify in **Supabase Dashboard**:
1. Go to **Table Editor**
2. Check **`districts`** table → Should have 4 rows
3. Check **`stores`** table → Should have 9 rows
4. All stores should have valid `district_id` foreign keys

---

## 🆘 Troubleshooting

**Problem:** Seed data script fails  
**Solution:** Make sure you ran `/migrations/organizational_hierarchy.sql` first (Phase 1)

**Problem:** Can't see "Organization Setup" in sidebar  
**Solution:** Make sure you're logged in as Admin or Trike Super Admin

**Problem:** Stores tab says "create at least one district first"  
**Solution:** Either run seed data or manually create a district first

**Problem:** Delete district fails  
**Solution:** Delete all stores in that district first

---

## ✅ You're Ready!
Your organizational hierarchy is now fully set up and manageable through the UI. You can now proceed to Phase 2: User Invitation System! 🎉
