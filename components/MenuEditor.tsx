import React, { useState } from "react";
import { View, Text, Pressable, Platform, Alert, Modal, TextInput } from "react-native";
import { Pencil } from "lucide-react-native";
import { useAdminMode } from "@/hooks/useAdminMode";
import { supabase } from "@/lib/supabase";
import { MenuGridItem } from "./MenuGridItem";
import type { UIMenuItem } from "@/lib/restaurant-types";

// We'll wrap the MenuGridItem to add admin overlays

function EditableMenuItem({
  item,
  index,
  onPress,
  onQuickAdd,
  onItemUpdated,
}: {
  item: UIMenuItem;
  index: number;
  onPress: () => void;
  onQuickAdd: () => void;
  onItemUpdated: (updatedItem: UIMenuItem) => void;
}) {
  const { isAdmin } = useAdminMode();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<"name" | "price" | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleEditClick = (field: "name" | "price") => {
    setEditField(field);
    setEditValue(field === "price" ? item.price.toString() : item.name);
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editField) return;

    let updateData: any = {};
    if (editField === "name") {
      updateData.name = editValue.trim();
    } else if (editField === "price") {
      const p = parseFloat(editValue);
      if (isNaN(p)) {
        Alert.alert("Error", "Invalid price");
        return;
      }
      updateData.price = p;
    }

    try {
      const { error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", item.id);

      if (error) throw error;
      
      // Update local UI state
      onItemUpdated({ ...item, ...updateData });
      setEditModalVisible(false);
    } catch (err: any) {
      console.error("Error updating menu item:", err);
      Alert.alert("Error", "Failed to update menu item.");
    }
  };

  return (
    <View style={{ position: "relative" }}>
      <MenuGridItem
        item={item as any}
        index={index}
        onPress={onPress}
        onQuickAdd={onQuickAdd}
      />
      {isAdmin && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "box-none",
            padding: 10,
            justifyContent: "flex-end",
            paddingBottom: 20,
          }}
        >
          {/* Edit Pencils */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Pressable
              onPress={() => handleEditClick("name")}
              style={{
                backgroundColor: "rgba(0,0,0,0.6)",
                padding: 6,
                borderRadius: 12,
              }}
            >
              <Pencil size={14} color="#FF9933" />
            </Pressable>
            <Pressable
              onPress={() => handleEditClick("price")}
              style={{
                backgroundColor: "rgba(0,0,0,0.6)",
                padding: 6,
                borderRadius: 12,
              }}
            >
              <Pencil size={14} color="#22C55E" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Edit Modal (Cross-platform safe) */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#1a1a1a", padding: 24, borderRadius: 16, width: "100%", borderWidth: 1, borderColor: "#333" }}>
            <Text style={{ fontFamily: "BricolageGrotesque_700Bold", color: "#FF9933", fontSize: 18, marginBottom: 12 }}>
              Edit {editField === "name" ? "Name" : "Price"}
            </Text>
            <TextInput
              style={{
                backgroundColor: "#0f0f0f",
                color: "#f5f5f5",
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#444",
                marginBottom: 16,
                marginTop: 12,
                fontSize: 16,
              }}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType={editField === "price" ? "decimal-pad" : "default"}
              autoFocus
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable onPress={() => setEditModalVisible(false)} style={{ padding: 12, marginRight: 8 }}>
                <Text style={{ color: "#999", fontFamily: "Manrope_600SemiBold" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={{ backgroundColor: "#FF9933", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 }}>
                <Text style={{ color: "#0f0f0f", fontFamily: "BricolageGrotesque_700Bold" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface MenuEditorProps {
  menu: UIMenuItem[];
  setMenu: (menu: UIMenuItem[]) => void;
  onItemPress: (item: UIMenuItem) => void;
  onQuickAdd: (item: UIMenuItem) => void;
}

export function MenuEditor({ menu, setMenu, onItemPress, onQuickAdd }: MenuEditorProps) {
  const leftColumn = menu.filter((_, i) => i % 2 === 0);
  const rightColumn = menu.filter((_, i) => i % 2 !== 0);

  const handleItemUpdated = (updatedItem: UIMenuItem) => {
    setMenu(menu.map(m => m.id === updatedItem.id ? updatedItem : m));
  };

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <View style={{ flex: 1, marginRight: 5 }}>
        {leftColumn.map((item, index) => (
          <EditableMenuItem
            key={item.id}
            item={item}
            index={index}
            onPress={() => onItemPress(item)}
            onQuickAdd={() => onQuickAdd(item)}
            onItemUpdated={handleItemUpdated}
          />
        ))}
      </View>
      <View style={{ flex: 1, marginLeft: 5 }}>
        {rightColumn.map((item, index) => (
          <EditableMenuItem
            key={item.id}
            item={item}
            index={index}
            onPress={() => onItemPress(item)}
            onQuickAdd={() => onQuickAdd(item)}
            onItemUpdated={handleItemUpdated}
          />
        ))}
      </View>
    </View>
  );
}
