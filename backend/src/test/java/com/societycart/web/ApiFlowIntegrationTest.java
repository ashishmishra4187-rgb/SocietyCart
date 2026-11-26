package com.societycart.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.societycart.domain.resident.ResidentRepository;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Exercises the real security chain (session cookie, CSRF, roles, CORS) and the whole join/cancel/admin
 * lifecycle over HTTP against the in-memory H2 database seeded by SampleDataLoader.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiFlowIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private SocietyRepository societyRepository;
    @Autowired
    private ResidentRepository residentRepository;

    @Autowired
    private com.societycart.domain.pool.PoolRepository poolRepository;

    private final ObjectMapper json = new ObjectMapper();

    /** A signed-in browser: its session cookie plus the XSRF cookie it would echo back in a header. */
    private record Browser(MockHttpSession session, Cookie xsrf, JsonNode login) {
        <T extends MockHttpServletRequestBuilder> T with(T request, boolean csrf) {
            request.session(session);
            if (csrf && xsrf != null) {
                request.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
            }
            return request;
        }
    }

    /** Existing account: request a code, verify it. */
    private Browser login(String phone) throws Exception {
        mvc.perform(post("/api/auth/otp").contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"" + phone + "\"}"))
                .andExpect(status().isNoContent());
        return verify(phone);
    }

    /** New account: create it (details held until the OTP is verified), then verify. */
    private Browser signUp(String phone, String name, String role, String adminCode) throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signupBody(phone, name, role, adminCode)))
                .andExpect(status().isNoContent());
        return verify(phone);
    }

    /** Shortcut used by most tests: a brand-new resident, signed up and signed in. */
    private Browser signIn(String phone) throws Exception {
        return signUp(phone, "Test Resident", "RESIDENT", null);
    }

    private String signupBody(String phone, String name, String role, String adminCode) {
        return "{\"phone\":\"" + phone + "\",\"name\":\"" + name + "\",\"societyId\":\"" + societyId() + "\","
                + "\"flatNumber\":\"B-1204\",\"role\":\"" + role + "\""
                + (adminCode == null ? "" : ",\"adminCode\":\"" + adminCode + "\"") + "}";
    }

    private Browser verify(String phone) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"otp\":\"123456\"}"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session, "verify must create a server-side session");
        return new Browser(session, result.getResponse().getCookie("XSRF-TOKEN"), json.readTree(result.getResponse().getContentAsString()));
    }

    private JsonNode firstOpenPool(Browser b) throws Exception {
        String societyId = b.login().get("societyId").asText();
        MvcResult r = mvc.perform(b.with(get("/api/pools/society/" + societyId), false))
                .andExpect(status().isOk()).andReturn();
        JsonNode pools = json.readTree(r.getResponse().getContentAsString());
        assertTrue(pools.size() > 0, "seed data should provide open pools");
        return pools.get(0);
    }

    private String joinBody(JsonNode pool, int qty) {
        return "{\"flatNumber\":\"B-1204\",\"items\":[{\"sku\":\"" + pool.get("productSku").asText() + "\",\"quantity\":" + qty + "}]}";
    }

    // ------------------------------------------------------------------ authentication

    @Test
    @DisplayName("Anonymous callers get 401 on every protected endpoint")
    void anonymousIsRejected() throws Exception {
        mvc.perform(get("/api/orders/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/residents/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/societies")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/pools/society/" + societyId())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/pools").param("societyId", societyId())).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("The society list for the sign-up form is public and exposes only id, name and city")
    void societiesAreListedPublicly() throws Exception {
        mvc.perform(get("/api/auth/societies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").isNotEmpty())
                .andExpect(jsonPath("$[0].name").isNotEmpty())
                .andExpect(jsonPath("$[0].joinCode").doesNotExist());
    }

    @Test
    @DisplayName("Sign in: a number with no account is told to create one; bad input is a readable 400")
    void signInUnknownNumberAndValidation() throws Exception {
        mvc.perform(post("/api/auth/otp").contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"12345\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("10-digit")));

        mvc.perform(post("/api/auth/otp").contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"9811111111\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("create an account")));
    }

    @Test
    @DisplayName("Sign up creates the account only after the OTP; the next visit is a plain sign-in")
    void signUpThenSignInAgain() throws Exception {
        String phone = "9811111112";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody(phone, "Asha Rao", "RESIDENT", null)))
                .andExpect(status().isNoContent());
        // Not an account yet: a plain sign-in request still says "no account".
        mvc.perform(post("/api/auth/otp").contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"" + phone + "\"}"))
                .andExpect(status().isNotFound());

        Browser first = verify(phone);
        assertTrue(first.login().get("newAccount").asBoolean());
        assertEquals("Asha Rao", first.login().get("name").asText());
        assertEquals("RESIDENT", first.login().get("role").asText());
        assertEquals("B-1204", first.login().get("flatNumber").asText());

        mvc.perform(first.with(get("/api/residents/me"), false))
                .andExpect(jsonPath("$.name").value("Asha Rao"))
                .andExpect(jsonPath("$.flatNumber").value("B-1204"));

        Browser again = login(phone);
        assertFalse(again.login().get("newAccount").asBoolean());
        assertEquals(first.login().get("residentId").asText(), again.login().get("residentId").asText(), "same account");
    }

    @Test
    @DisplayName("Sign up with a number that already has an account is a 409")
    void signUpExistingAccountConflicts() throws Exception {
        signUp("9811111113", "First Person", "RESIDENT", null);
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111113", "Someone Else", "RESIDENT", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("sign in")));
    }

    @Test
    @DisplayName("Sign-up validation: bad name, unknown society and unknown role are rejected")
    void signUpValidation() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111114", "1", "RESIDENT", null)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111114", "Valid Name", "SUPERUSER", null)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111114", "Valid Name", "RESIDENT", null)
                                .replace(societyId(), "00000000-0000-0000-0000-000000000000")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A wrong code does not create the account, and verifying without a sign-up is a plain 401")
    void wrongCodeAndNoSignup() throws Exception {
        String phone = "9811111115";
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody(phone, "Asha Rao", "RESIDENT", null)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"otp\":\"000000\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertTrue(residentRepository.findByPhone(phone).isEmpty(), "no account without a correct code");

        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"9811111116\",\"otp\":\"123456\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Society admin sign-up needs the admin code; residents cannot promote themselves")
    void adminSignUpNeedsCode() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111117", "Wannabe Admin", "SOCIETY_ADMIN", null)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(signupBody("9811111117", "Wannabe Admin", "SOCIETY_ADMIN", "guess")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("admin code")));

        Browser admin = signUp("9811111118", "Real Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        assertEquals("SOCIETY_ADMIN", admin.login().get("role").asText());
        mvc.perform(admin.with(get("/api/admin/pools").param("societyId", societyId()), false)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Signing in returns the identity and a session; the session cookie is httpOnly and no token is exposed")
    void signInIssuesSession() throws Exception {
        Browser b = signUp("9822222222", "Asha Rao", "RESIDENT", null);
        assertEquals("RESIDENT", b.login().get("role").asText());
        assertFalse(b.login().get("societyId").asText().isBlank());
        assertFalse(b.login().has("token"), "no bearer token should ever be returned");
        assertNotNull(b.xsrf(), "the XSRF-TOKEN cookie must be issued for the SPA");

        mvc.perform(b.with(get("/api/residents/me"), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("9822222222"));
    }

    // ------------------------------------------------------------------ CSRF / CORS

    @Test
    @DisplayName("State-changing calls need the CSRF header even with a valid session")
    void csrfIsEnforced() throws Exception {
        Browser b = signIn("9833333333");
        JsonNode pool = firstOpenPool(b);

        mvc.perform(b.with(post("/api/pools/" + pool.get("poolWindowId").asText() + "/orders")
                        .contentType(MediaType.APPLICATION_JSON).content(joinBody(pool, 1)), false))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("CORS allows the configured web origin with credentials and refuses others")
    void cors() throws Exception {
        mvc.perform(options("/api/orders/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));

        mvc.perform(options("/api/orders/me")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ resident journey

    @Test
    @DisplayName("Join, retry safely, refuse a second join, list orders, then cancel")
    void residentJourney() throws Exception {
        Browser b = signIn("9844444444");
        JsonNode pool = firstOpenPool(b);
        String poolId = pool.get("poolWindowId").asText();
        int before = pool.get("aggregateQuantity").asInt();

        MvcResult joined = mvc.perform(b.with(post("/api/pools/" + poolId + "/orders")
                        .header("Idempotency-Key", "journey-1")
                        .contentType(MediaType.APPLICATION_JSON).content(joinBody(pool, 3)), true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aggregateQuantity").value(before + 3))
                .andExpect(jsonPath("$.productSku").value(pool.get("productSku").asText()))
                .andReturn();
        assertTrue(json.readTree(joined.getResponse().getContentAsString()).get("cutoffAt").isTextual(),
                "instants must serialise as ISO strings");

        // Same key again (flaky network retry): same state, no double count.
        mvc.perform(b.with(post("/api/pools/" + poolId + "/orders")
                        .header("Idempotency-Key", "journey-1")
                        .contentType(MediaType.APPLICATION_JSON).content(joinBody(pool, 3)), true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aggregateQuantity").value(before + 3));

        // A new attempt for the same pool is a conflict.
        mvc.perform(b.with(post("/api/pools/" + poolId + "/orders")
                        .header("Idempotency-Key", "journey-2")
                        .contentType(MediaType.APPLICATION_JSON).content(joinBody(pool, 1)), true))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("already joined")));

        MvcResult orders = mvc.perform(b.with(get("/api/orders/me"), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("COMMITTED"))
                .andExpect(jsonPath("$[0].quantity").value(3))
                .andReturn();
        String orderId = json.readTree(orders.getResponse().getContentAsString()).get(0).get("orderId").asText();

        mvc.perform(b.with(get("/api/orders/" + orderId), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flatNumber").value("B-1204"))
                .andExpect(jsonPath("$.pool.productSku").value(pool.get("productSku").asText()));

        mvc.perform(b.with(delete("/api/pools/" + poolId + "/orders/" + orderId), true))
                .andExpect(status().isNoContent());

        mvc.perform(b.with(get("/api/orders/me"), false))
                .andExpect(jsonPath("$[0].status").value("CANCELLED"));
        mvc.perform(b.with(get("/api/pools/" + poolId), false))
                .andExpect(jsonPath("$.aggregateQuantity").value(before));
    }

    @Test
    @DisplayName("Residents cannot read each other's orders")
    void ordersArePrivate() throws Exception {
        Browser owner = signIn("9855555555");
        JsonNode pool = firstOpenPool(owner);
        mvc.perform(owner.with(post("/api/pools/" + pool.get("poolWindowId").asText() + "/orders")
                .contentType(MediaType.APPLICATION_JSON).content(joinBody(pool, 1)), true)).andExpect(status().isOk());
        MvcResult r = mvc.perform(owner.with(get("/api/orders/me"), false)).andReturn();
        String orderId = json.readTree(r.getResponse().getContentAsString()).get(0).get("orderId").asText();

        Browser other = signIn("9866666666");
        mvc.perform(other.with(get("/api/orders/" + orderId), false)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Joining validates the payload and the SKU")
    void joinValidation() throws Exception {
        Browser b = signIn("9877777777");
        JsonNode pool = firstOpenPool(b);
        String url = "/api/pools/" + pool.get("poolWindowId").asText() + "/orders";

        mvc.perform(b.with(post(url).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flatNumber\":\"<script>\",\"items\":[{\"sku\":\"x\",\"quantity\":1}]}"), true))
                .andExpect(status().isBadRequest());
        mvc.perform(b.with(post(url).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flatNumber\":\"B-1\",\"items\":[{\"sku\":\"NOT-THIS-POOL\",\"quantity\":1}]}"), true))
                .andExpect(status().isBadRequest());
        mvc.perform(b.with(post(url).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flatNumber\":\"B-1\",\"items\":[{\"sku\":\"" + pool.get("productSku").asText() + "\",\"quantity\":0}]}"), true))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ admin

    @Test
    @DisplayName("A plain resident is forbidden from the admin API")
    void residentCannotUseAdminApi() throws Exception {
        Browser b = signIn("9888888888");
        mvc.perform(b.with(get("/api/admin/pools").param("societyId", societyId()), false))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin opens a pool, a resident joins, admin closes, dispatches and marks delivered")
    void adminLifecycle() throws Exception {
        Society society = societyRepository.findByActiveTrue().get(0);
        Browser adminBrowser = signUp("9900000001", "Society Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        assertEquals("SOCIETY_ADMIN", adminBrowser.login().get("role").asText());

        String cutoff = Instant.now().plus(2, ChronoUnit.HOURS).toString();
        String sku = "IT-" + System.nanoTime();
        addProduct(adminBrowser, society.getId().toString(), sku, "IT Oil");
        // A tier that undercuts the floor is a 400 with a readable reason.
        mvc.perform(adminBrowser.with(post("/api/admin/pools").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + society.getId() + "\",\"productSku\":\"" + sku + "\","
                                + "\"basePrice\":200,\"floorPrice\":190,\"cutoffAt\":\"" + cutoff + "\","
                                + "\"tiers\":[{\"minQuantity\":2,\"discountPercent\":50}]}"), true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("floor")));

        MvcResult created = mvc.perform(adminBrowser.with(post("/api/admin/pools").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + society.getId() + "\",\"productSku\":\"" + sku + "\","
                                + "\"basePrice\":200,\"floorPrice\":120,\"cutoffAt\":\"" + cutoff + "\","
                                + "\"tiers\":[{\"minQuantity\":2,\"discountPercent\":10},{\"minQuantity\":5,\"discountPercent\":25}]}"), true))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.tiers.length()").value(2))
                .andExpect(jsonPath("$.productName").value("IT Oil"))
                .andReturn();
        String poolId = json.readTree(created.getResponse().getContentAsString()).get("poolWindowId").asText();

        Browser resident = signIn("9900000002");
        mvc.perform(resident.with(post("/api/pools/" + poolId + "/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flatNumber\":\"C-7\",\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":6}]}"), true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUnitPrice").value(150.0));

        mvc.perform(adminBrowser.with(get("/api/admin/pools/" + poolId), false))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.supplierPOPayload").doesNotExist());

        mvc.perform(adminBrowser.with(post("/api/shopkeeper/pools/" + poolId + "/dispatch"), true))
                .andExpect(status().isForbidden());

        mvc.perform(adminBrowser.with(post("/api/admin/pools/" + poolId + "/close"), true))
                .andExpect(status().isNoContent());
        mvc.perform(adminBrowser.with(get("/api/admin/pools/" + poolId), false))
                .andExpect(jsonPath("$.status").value("LOCKED"))
                .andExpect(jsonPath("$.supplierPOPayload.sku").value(sku))
                .andExpect(jsonPath("$.supplierPOPayload.totalQuantity").value(6));

        mvc.perform(resident.with(get("/api/orders/me"), false))
                .andExpect(jsonPath("$[0].status").value("LOCKED"))
                .andExpect(jsonPath("$[0].unitPriceAtCommit").value(150.0));

        signIn("9900000003");
        var account = residentRepository.findByPhone("9900000003").orElseThrow();
        account.setRole(com.societycart.domain.resident.Resident.Role.SHOPKEEPER);
        residentRepository.save(account);
        Browser shop = login("9900000003");
        mvc.perform(shop.with(post("/api/shopkeeper/pools/" + poolId + "/dispatch"), true))
                .andExpect(status().isConflict());
        var expired = poolRepository.findById(java.util.UUID.fromString(poolId)).orElseThrow();
        expired.setEndTime(java.time.Instant.now().minusSeconds(1));
        poolRepository.save(expired);
        mvc.perform(shop.with(post("/api/shopkeeper/pools/" + poolId + "/dispatch"), true))
                .andExpect(status().isNoContent());
        mvc.perform(shop.with(post("/api/shopkeeper/pools/" + poolId + "/dispatch"), true))
                .andExpect(status().isConflict());
        mvc.perform(adminBrowser.with(post("/api/admin/pools/" + poolId + "/deliver"), true))
                .andExpect(status().isNoContent());
        mvc.perform(adminBrowser.with(get("/api/admin/pools/" + poolId), false))
                .andExpect(jsonPath("$.status").value("DELIVERED"));
        mvc.perform(resident.with(get("/api/orders/me/history").param("past", "true"), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.past").value(1))
                .andExpect(jsonPath("$.orders[0].orderId").exists())
                .andExpect(jsonPath("$.saved").value(300));
        mvc.perform(resident.with(get("/api/orders/me/history").param("page", "-1"), false))
                .andExpect(status().isBadRequest());
        mvc.perform(adminBrowser.with(get("/api/admin/pools/history").param("societyId", society.getId().toString()), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pools[0].poolWindowId").exists());
    }

    private String addProduct(Browser admin, String societyId, String sku, String name) throws Exception {
        MvcResult r = mvc.perform(admin.with(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId + "\",\"sku\":\"" + sku + "\",\"name\":\"" + name + "\","
                                + "\"imageUrl\":\"https://img.example/p.png\",\"category\":\"Groceries\",\"unit\":\"L\",\"basePrice\":200}"), true))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }

    private String openDeal(Browser admin, String sku, int hoursFromNow) throws Exception {
        MvcResult r = mvc.perform(admin.with(post("/api/admin/pools").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId() + "\",\"productSku\":\"" + sku + "\","
                                + "\"basePrice\":200,\"floorPrice\":120,\"cutoffAt\":\"" + Instant.now().plus(hoursFromNow, ChronoUnit.HOURS) + "\","
                                + "\"tiers\":[{\"minQuantity\":2,\"discountPercent\":10}]}"), true))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("poolWindowId").asText();
    }

    @Test
    @DisplayName("Product catalog: add, reject duplicates, edit, archive; a deal needs an active catalog product")
    void productCatalog() throws Exception {
        Browser admin = signUp("9911111101", "Catalog Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        String sku = "CAT-" + System.nanoTime();
        String id = addProduct(admin, societyId(), sku, "Catalog Rice");

        mvc.perform(admin.with(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId() + "\",\"sku\":\"" + sku + "\",\"name\":\"Dup\",\"basePrice\":10}"), true))
                .andExpect(status().isConflict());
        mvc.perform(admin.with(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId() + "\",\"sku\":\"" + sku + "-2\",\"name\":\"Bad link\",\"imageUrl\":\"javascript:alert(1)\",\"basePrice\":10}"), true))
                .andExpect(status().isBadRequest());

        mvc.perform(admin.with(patch("/api/admin/products/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Catalog Basmati\",\"basePrice\":220}"), true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Catalog Basmati"))
                .andExpect(jsonPath("$.sku").value(sku));
        mvc.perform(admin.with(get("/api/admin/products").param("societyId", societyId()), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.sku == '" + sku + "')].name").value("Catalog Basmati"));

        // Opening a deal takes the name/photo from the catalog.
        String poolId = openDeal(admin, sku, 3);
        mvc.perform(admin.with(get("/api/admin/pools/" + poolId), false))
                .andExpect(jsonPath("$.productName").value("Catalog Basmati"))
                .andExpect(jsonPath("$.imageUrl").value("https://img.example/p.png"));

        // Unknown or archived products cannot be used for a new deal.
        mvc.perform(admin.with(post("/api/admin/pools").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId() + "\",\"productSku\":\"NOT-IN-CATALOG\",\"basePrice\":200,\"floorPrice\":120,"
                                + "\"cutoffAt\":\"" + Instant.now().plus(3, ChronoUnit.HOURS) + "\",\"tiers\":[{\"minQuantity\":2,\"discountPercent\":10}]}"), true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("product list")));
        mvc.perform(admin.with(patch("/api/admin/products/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"), true))
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    @DisplayName("Residents cannot read or change the product catalog")
    void residentCannotUseCatalog() throws Exception {
        Browser resident = signIn("9911111102");
        mvc.perform(resident.with(get("/api/admin/products").param("societyId", societyId()), false)).andExpect(status().isForbidden());
        mvc.perform(resident.with(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"societyId\":\"" + societyId() + "\",\"sku\":\"HACK-1\",\"name\":\"x\",\"basePrice\":1}"), true))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin changes an open deal's closing time; bad times are rejected with a reason")
    void changeClosingTime() throws Exception {
        Browser admin = signUp("9911111103", "Time Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        String sku = "TIME-" + System.nanoTime();
        addProduct(admin, societyId(), sku, "Time Oil");
        String poolId = openDeal(admin, sku, 2);

        String later = Instant.now().plus(26, ChronoUnit.HOURS).toString();
        mvc.perform(admin.with(patch("/api/admin/pools/" + poolId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cutoffAt\":\"" + later + "\"}"), true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"));
        Browser resident = signIn("9911111104");
        mvc.perform(resident.with(get("/api/pools/" + poolId), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cutoffAt").value(org.hamcrest.Matchers.startsWith(later.substring(0, 16))));

        mvc.perform(admin.with(patch("/api/admin/pools/" + poolId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cutoffAt\":\"" + Instant.now().plus(1, ChronoUnit.MINUTES) + "\"}"), true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("5 minutes")));
        mvc.perform(resident.with(patch("/api/admin/pools/" + poolId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cutoffAt\":\"" + later + "\"}"), true))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Cancelling a deal cancels residents' orders; a cancelled deal can't be closed or dispatched")
    void cancelDeal() throws Exception {
        Browser admin = signUp("9911111105", "Cancel Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        String sku = "CAN-" + System.nanoTime();
        addProduct(admin, societyId(), sku, "Cancel Oil");
        String poolId = openDeal(admin, sku, 4);

        Browser resident = signIn("9911111106");
        mvc.perform(resident.with(post("/api/pools/" + poolId + "/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flatNumber\":\"C-3\",\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":2}]}"), true))
                .andExpect(status().isOk());

        mvc.perform(admin.with(post("/api/admin/pools/" + poolId + "/cancel"), true)).andExpect(status().isNoContent());

        mvc.perform(admin.with(get("/api/admin/pools/" + poolId), false)).andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(resident.with(get("/api/orders/me"), false))
                .andExpect(jsonPath("$[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$[0].poolStatus").value("CANCELLED"));

        mvc.perform(admin.with(post("/api/admin/pools/" + poolId + "/close"), true)).andExpect(status().isConflict());
        mvc.perform(admin.with(post("/api/shopkeeper/pools/" + poolId + "/dispatch"), true)).andExpect(status().isForbidden());
        mvc.perform(admin.with(post("/api/admin/pools/" + poolId + "/cancel"), true)).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Packing list shows each flat's units in natural flat order and excludes cancelled orders")
    void packingList() throws Exception {
        Browser admin = signUp("9911111107", "Pack Admin", "SOCIETY_ADMIN", "TEST-ADMIN-CODE");
        String sku = "PACK-" + System.nanoTime();
        addProduct(admin, societyId(), sku, "Pack Oil");
        String poolId = openDeal(admin, sku, 4);

        String[][] buyers = {{"9911111108", "B-10", "2"}, {"9911111109", "B-2", "1"}, {"9911111110", "A-1", "3"}, {"9911111111", "C-9", "4"}};
        String cancelledOrderId = null;
        for (String[] b : buyers) {
            Browser r = signIn(b[0]);
            mvc.perform(r.with(post("/api/pools/" + poolId + "/orders").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"flatNumber\":\"" + b[1] + "\",\"items\":[{\"sku\":\"" + sku + "\",\"quantity\":" + b[2] + "}]}"), true))
                    .andExpect(status().isOk());
            if (b[1].equals("C-9")) {
                MvcResult o = mvc.perform(r.with(get("/api/orders/me"), false)).andReturn();
                cancelledOrderId = json.readTree(o.getResponse().getContentAsString()).get(0).get("orderId").asText();
                mvc.perform(r.with(delete("/api/pools/" + poolId + "/orders/" + cancelledOrderId), true)).andExpect(status().isNoContent());
            }
        }

        mvc.perform(admin.with(post("/api/admin/pools/" + poolId + "/close"), true)).andExpect(status().isNoContent());
        mvc.perform(admin.with(get("/api/admin/pools/" + poolId + "/packing-list"), false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sku").value(sku))
                .andExpect(jsonPath("$.totalUnits").value(6))
                .andExpect(jsonPath("$.lines.length()").value(3))
                .andExpect(jsonPath("$.lines[0].flatNumber").value("A-1"))
                .andExpect(jsonPath("$.lines[1].flatNumber").value("B-2"))
                .andExpect(jsonPath("$.lines[2].flatNumber").value("B-10"))
                .andExpect(jsonPath("$.lines[0].quantity").value(3));

        Browser resident = signIn("9911111112");
        mvc.perform(resident.with(get("/api/admin/pools/" + poolId + "/packing-list"), false)).andExpect(status().isForbidden());
    }

    private String societyId() {
        return societyRepository.findByActiveTrue().get(0).getId().toString();
    }
}
