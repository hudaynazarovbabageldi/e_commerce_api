const { DataTypes, Model, Ordei } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
    class User extends Model {
        // Instance method to compare password
        async comparePassword(password) {
            return await bcrypt.compare(password, this.password);
        }

        // Override toJSON to exclude sensitive fields
        toJSON() {
            const values = { ...this.get() };
            delete values.password;
            delete values.resetPasswordToken;
            delete values.verificationToken;
            return values;
        }

        // Static method to find user by email
        static async findByEmail(email) {
            return await this.findOne({
                where: { email: email.toLowerCase() },
            });
        }
    }

    User.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
                set(value) {
                    this.setDataValue('email', value.toLowerCase());
                },
            },
            password: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    len: [8, 255],
                },
            },
            firstName: {
                type: DataTypes.STRING(100),
                allowNull: false,
                field: 'first_name',
            },
            lastName: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'last_name',
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: true,
            },
            role: {
                type: DataTypes.ENUM('customer', 'admin', 'moderator'),
                defaultValue: 'customer',
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                field: 'is_active',
            },
            emailVerified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: 'email_verified',
            },
            avatar: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },
            dateOfBirth: {
                type: DataTypes.DATEONLY,
                allowNull: true,
                field: 'date_of_birth',
            },
            lastLoginAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_login_at',
            },
            resetPasswordToken: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'reset_password_token',
            },
            resetPasswordExpires: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'reset_password_expires',
            },
            verificationToken: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'verification_token',
            },
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
            timestamps: true,
            underscored: true,
            hooks: {
                beforeCreate: async (user) => {
                    if (user.password) {
                        const salt = await bcrypt.genSalt(10);
                        user.password = await bcrypt.hash(user.password, salt);
                    }
                },
                beforeUpdate: async (user) => {
                    if (user.changed('password')) {
                        const salt = await bcrypt.genSalt(10);
                        user.password = await bcrypt.hash(user.password, salt);
                    }
                },
            },
            indexes: [
                { unique: true, fields: ['email'] },
                { fields: ['role'] },
                { fields: ['is_active'] },
            ],
        },
    );

    return User;
};
