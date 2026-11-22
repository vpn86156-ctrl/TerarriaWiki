using Microsoft.Xna.Framework;
using Terraria;
using Terraria.DataStructures;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Players;
using WikiStarter.Content.Projectiles;

namespace WikiStarter.Content.Items
{
    public class FallenGodsFlame : ModItem
    {
        public override void SetDefaults()
        {
            Item.damage = 150;
            Item.DamageType = DamageClass.Melee;
            Item.width = 72;
            Item.height = 72;
            Item.useTime = 28;
            Item.useAnimation = 28;
            Item.useStyle = ItemUseStyleID.Swing;
            Item.knockBack = 10f;
            Item.value = Item.buyPrice(gold: 5);
            Item.rare = ItemRarityID.Orange;
            Item.UseSound = SoundID.Item1;
            Item.autoReuse = true;
            Item.useTurn = true;
            Item.scale = 1.1f;
            Item.shoot = ModContent.ProjectileType<DivineFlame>();
            Item.shootSpeed = 12f;
        }

        public override bool AltFunctionUse(Player player)
        {
            return true;
        }

        public override void UseStyle(Player player, Rectangle heldItemFrame)
        {
            if (player.altFunctionUse == 2 || player.itemAnimationMax <= 0)
                return;

            // Give the normal slash a deliberate, wide arc instead of the default short swing.
            float progress = MathHelper.Clamp(1f - player.itemAnimation / (float)player.itemAnimationMax, 0f, 1f);
            progress = progress * progress * (3f - 2f * progress);
            float swingAngle = MathHelper.Lerp(-1.35f, 1.2f, progress);
            player.itemRotation = swingAngle * player.direction * player.gravDir;
        }

        public override bool CanUseItem(Player player)
        {
            if (player.altFunctionUse == 2)
            {
                if (player.GetModPlayer<GodslayerPlayer>().DivineWaveCooldown > 0)
                    return false;

                Item.damage = 230;
                Item.knockBack = 12f;
                Item.useTime = 36;
                Item.useAnimation = 36;
                Item.shoot = ModContent.ProjectileType<DivineWave>();
                Item.shootSpeed = 10f;
                Item.noMelee = true;
            }
            else
            {
                Item.damage = 150;
                Item.knockBack = 10f;
                Item.useTime = 28;
                Item.useAnimation = 28;
                Item.shoot = ModContent.ProjectileType<DivineFlame>();
                Item.shootSpeed = 12f;
                Item.noMelee = false;
            }

            return base.CanUseItem(player);
        }

        public override bool Shoot(Player player, EntitySource_ItemUse_WithAmmo source, Vector2 position, Vector2 velocity, int type, int damage, float knockback)
        {
            if (player.altFunctionUse == 2)
            {
                player.GetModPlayer<GodslayerPlayer>().DivineWaveCooldown = 240;
                Projectile.NewProjectile(source, position, velocity, type, (int)(damage * 0.9f), knockback, player.whoAmI);
            }
            else
            {
                Projectile.NewProjectile(source, position, velocity, type, (int)(damage * 0.75f), knockback, player.whoAmI);
            }

            return false;
        }

        public override void OnHitNPC(Player player, NPC target, NPC.HitInfo hit, int damageDone)
        {
            target.AddBuff(BuffID.OnFire, 300);
        }

        public override void AddRecipes()
        {
            CreateRecipe()
                .AddIngredient(ItemID.HellstoneBar, 15)
                .AddIngredient(ItemID.FallenStar, 5)
                .AddIngredient(ItemID.Fireblossom, 3)
                .AddIngredient(ModContent.ItemType<FallenGodHeart>())
                .AddTile(TileID.Hellforge)
                .Register();
        }
    }
}
