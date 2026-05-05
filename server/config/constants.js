class constants {
    static PRODUCT_TYPES = {
        PROTEIN: 'protein',
        PREWORKOUT: 'preworkout',
        VITAMINS: 'vitamins',
        ACCESSORIES: 'accessories',
    };

    static USER_ROLES = {
        ADMIN: 'admin',
        MANAGER: 'manager',
        TRAINER: 'trainer',
        USER: 'user',
    };

    static GENDER = {
        MALE: 'male',
        FEMALE: 'female',
        OTHER: 'other',
    };

    static values(obj) {
        return Object.values(obj);
    }

    static isValid(obj, value) {
        return this.values(obj).includes(value);
    }
}

export default constants;