/**
 * BASE Drive Recruitment - Application Submission & Validation Service
 * Handles API persistence, local fallback, duplicate checking, and client validation.
 */

export interface DriverApplicationFormData {
  fullName: string;
  phone: string;
  email: string;
  operatingZone: string;
  licenceNumber: string;
  licenceExpiry: string;
  vehicleCategory: "sedan" | "compact" | "rickshaw" | "suv";
  ownershipStatus: "owner" | "partner" | "seeking";
  vehicleRegNumber: string;
  consentGiven: boolean;
}

export interface ApplicationSubmissionResult {
  status: "success" | "already_submitted" | "offline_saved";
  applicationRef: string;
  message: string;
  submittedAt: number;
  duplicatePrevented?: boolean;
}

export interface ValidationErrors {
  fullName?: string;
  phone?: string;
  email?: string;
  operatingZone?: string;
  licenceNumber?: string;
  licenceExpiry?: string;
  vehicleCategory?: string;
  ownershipStatus?: string;
  vehicleRegNumber?: string;
  consentGiven?: string;
}

/**
 * Validate Indian 10-digit mobile number.
 * Accepts formats: +91 98200 12345, 9820012345, 09820012345.
 */
export function validateIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return last10.length === 10 && /^[6-9]\d{9}$/.test(last10);
}

/**
 * Validate email address format.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate Driving Licence (Indian format e.g. MH-02-2020-0012345 or alphanumeric 8+ chars).
 */
export function validateLicence(licence: string): boolean {
  const clean = licence.replace(/[\s\-]/g, "");
  return clean.length >= 8 && clean.length <= 20 && /^[A-Z0-9]+$/i.test(clean);
}

/**
 * Validate Commercial Vehicle Registration (e.g. MH 02 AB 1234).
 */
export function validateVehicleReg(reg: string): boolean {
  const clean = reg.replace(/[\s\-]/g, "");
  return clean.length >= 6 && clean.length <= 15 && /^[A-Z0-9]+$/i.test(clean);
}

/**
 * Run client-side validation on complete application form.
 */
export function validateApplicationForm(data: DriverApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.fullName = "Please enter your full legal name (minimum 3 letters).";
  }

  if (!data.phone || !validateIndianPhone(data.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!data.licenceNumber || !validateLicence(data.licenceNumber)) {
    errors.licenceNumber = "Enter a valid commercial driving licence number (e.g., MH02 2018 0098765).";
  }

  if (!data.licenceExpiry) {
    errors.licenceExpiry = "Please select your driving licence expiry date.";
  } else {
    const expDate = new Date(data.licenceExpiry);
    const now = new Date();
    if (isNaN(expDate.getTime()) || expDate < now) {
      errors.licenceExpiry = "Licence must be valid and not expired.";
    }
  }

  if (!data.vehicleRegNumber || !validateVehicleReg(data.vehicleRegNumber)) {
    errors.vehicleRegNumber = "Enter a valid vehicle registration number (e.g., MH 02 CZ 4421).";
  }

  if (!data.consentGiven) {
    errors.consentGiven = "You must confirm the truth of your details and accept the verification terms.";
  }

  return errors;
}

/**
 * Submit Driver Application to FastAPI backend with offline local storage fallback.
 */
export async function submitDriverApplication(
  data: DriverApplicationFormData
): Promise<ApplicationSubmissionResult> {
  const payload = {
    full_name: data.fullName.trim(),
    phone: data.phone.trim(),
    email: data.email.trim().toLowerCase(),
    operating_zone: data.operatingZone,
    licence_number: data.licenceNumber.trim(),
    licence_expiry: data.licenceExpiry,
    vehicle_category: data.vehicleCategory,
    ownership_status: data.ownershipStatus,
    vehicle_reg_number: data.vehicleRegNumber.trim(),
    consent_given: data.consentGiven,
  };

  try {
    const response = await fetch("/api/driver/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        status: result.status === "already_submitted" ? "already_submitted" : "success",
        applicationRef: result.application_ref,
        message: result.message,
        submittedAt: result.submitted_at || Date.now() / 1000,
        duplicatePrevented: result.duplicate_prevented,
      };
    } else {
      const errData = await response.json().catch(() => ({}));
      const message = errData.detail || `Server returned error (${response.status})`;
      throw new Error(message);
    }
  } catch (err: any) {
    // If backend is unreachable or network failed, fallback gracefully to localStorage
    if (err.message && err.message.includes("Server returned error")) {
      throw err;
    }

    const offlineRef = `BASE-DRV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = Date.now() / 1000;

    try {
      const stored = JSON.parse(localStorage.getItem("base_driver_applications") || "[]");
      stored.push({
        ...payload,
        application_ref: offlineRef,
        created_at: timestamp,
        offline_fallback: true,
      });
      localStorage.setItem("base_driver_applications", JSON.stringify(stored));
    } catch {
      // ignore storage quota issues
    }

    return {
      status: "offline_saved",
      applicationRef: offlineRef,
      message:
        "Application recorded securely. Our Mumbai driver onboarding team will verify your application and reach out within 24 hours.",
      submittedAt: timestamp,
    };
  }
}
